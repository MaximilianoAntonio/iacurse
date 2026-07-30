"""
Vistas de aprendizaje — el endpoint attempt con orden de side-effects exacto.

Orden reproducido fielmente desde src/app/api/activities/[id]/attempt/route.ts:
1. maxAttempts check (429 si excedido)
2. Grade la respuesta
3. Genera feedback IA
4. Snapshot prev-correct (¿ya tenía un intento correcto antes?)
5. Crea el Attempt
6. Progress upsert (re-calcula completed/total/mastery)
7. User points update (solo primer correcto gana puntos completos)
8. Streak update
9. Unit-completion detection
10. Badge check (check_and_award_badges)
"""
from django.db import transaction
from django.db.models import Count, F, Max
from django.utils import timezone
from rest_framework import status, views
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import User
from curriculum.models import Activity, Unit
from .badges import check_and_award_badges
from .grading import grade
from .models import Attempt, Badge, Bookmark, Progress, UserBadge
from .streak import update_streak


class AttemptView(views.APIView):
    """POST /api/activities/<id>/attempt — registra un intento.

    Reproduce el flujo completo con side-effects en orden exacto.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, activity_id):
        user = request.user

        body = request.data or {}
        answer = body.get("answer")
        if not answer:
            return Response({"error": "Faltan answer"}, status=status.HTTP_400_BAD_REQUEST)
        time_spent = body.get("timeSpent")
        hints_used = body.get("hintsUsed", 0)

        # Cargar actividad con relaciones
        try:
            activity = Activity.objects.select_related(
                "lesson__unit", "rubric"
            ).get(pk=activity_id)
        except Activity.DoesNotExist:
            return Response({"error": "Actividad no encontrada"}, status=status.HTTP_404_NOT_FOUND)

        # --- 1. maxAttempts check ---
        if activity.max_attempts > 0:
            prior_count = Attempt.objects.filter(user=user, activity=activity).count()
            if prior_count >= activity.max_attempts:
                return Response(
                    {
                        "error": "Has alcanzado el número máximo de intentos para esta actividad.",
                        "maxAttemptsReached": True,
                        "maxAttempts": activity.max_attempts,
                    },
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )

        # --- 2. Grade ---
        grade_result = grade(activity, answer)

        # --- 3. AI feedback ---
        from tutor.services import generate_activity_feedback

        unit = activity.lesson.unit
        context = f"{unit.title} — {activity.lesson.title}"
        objective_descs = list(
            activity.objectives.select_related("objective").values_list(
                "objective__description", flat=True
            )
        )
        feedback = generate_activity_feedback(
            activity_type=activity.type,
            activity_title=activity.title,
            prompt=activity.prompt,
            student_answer=answer,
            is_correct=grade_result.is_correct,
            correct_answer=grade_result.correct_answer,
            context=context,
            assessment_type=activity.assessment_type,
            bloom_level=activity.bloom_level,
            objectives=objective_descs,
            rubric_criteria=activity.rubric.criteria if activity.rubric else None,
        )

        # --- 4. Snapshot prev-correct (antes de crear el nuevo attempt) ---
        had_previous_correct = Attempt.objects.filter(
            user=user, activity=activity, correct=True
        ).first()

        # --- 5. Crear el Attempt ---
        with transaction.atomic():
            attempt = Attempt.objects.create(
                user=user,
                activity=activity,
                answer=answer,
                feedback=feedback,
                score=grade_result.score,
                correct=grade_result.is_correct,
                time_spent=time_spent,
                hints_used=hints_used or 0,
            )

            # --- 6. Progress upsert ---
            total_activities = Activity.objects.filter(lesson__unit=unit).count()
            correct_activities = (
                Attempt.objects.filter(user=user, activity__lesson__unit=unit, correct=True)
                .values("activity_id").distinct().count()
            )
            completed = min(correct_activities, total_activities)
            mastery = (
                min(100, round((completed / total_activities) * 100))
                if total_activities > 0 else 0
            )
            progress, _ = Progress.objects.update_or_create(
                user=user, unit=unit,
                defaults={
                    "completed": completed,
                    "total": total_activities,
                    "mastery": mastery,
                    "last_visited": timezone.now(),
                },
            )

            # --- 7. User points update ---
            points_awarded = 0
            if grade_result.is_correct and not had_previous_correct:
                # Primer correcto: score completo
                points_awarded = grade_result.score
                User.objects.filter(pk=user.pk).update(
                    points=F("points") + points_awarded,
                    last_active=timezone.now(),
                )
            elif not grade_result.is_correct and grade_result.score > 0:
                # Incorrecto con puntaje parcial: delta sobre el mejor previo correcto
                prev_score = had_previous_correct.score if had_previous_correct else 0
                points_awarded = max(0, grade_result.score - (prev_score or 0))
                if points_awarded > 0:
                    User.objects.filter(pk=user.pk).update(
                        points=F("points") + points_awarded,
                        last_active=timezone.now(),
                    )

            # --- 8. Streak update ---
            update_streak(user)

            # --- 9. Unit-completion detection ---
            correct_after = (
                Attempt.objects.filter(user=user, activity__lesson__unit=unit, correct=True)
                .values("activity_id").distinct().count()
            )
            unit_total = total_activities
            unit_completed = (
                grade_result.is_correct
                and not had_previous_correct
                and unit_total > 0
                and correct_after == unit_total
            )

        # --- 10. Badge check ---
        new_badges = check_and_award_badges(user)
        # Re-leer puntos frescos
        user.refresh_from_db()

        # attemptsRemaining
        if activity.max_attempts > 0:
            new_count = Attempt.objects.filter(user=user, activity=activity).count()
            attempts_remaining = max(0, activity.max_attempts - 1 - new_count)
        else:
            attempts_remaining = -1

        return Response({
            "attempt": {
                "id": attempt.id,
                "correct": grade_result.is_correct,
                "score": grade_result.score,
                "feedback": feedback,
                "correctAnswer": grade_result.correct_answer,
                "pointsAwarded": points_awarded,
                "newBadges": [b.to_dict() for b in new_badges],
                "unitCompleted": unit_completed,
                "unitTitle": unit.title,
                "unitColor": unit.color,
                "unitIcon": unit.icon,
                "assessmentType": activity.assessment_type,
                "bloomLevel": activity.bloom_level,
                "masteryThreshold": activity.mastery_threshold,
                "masteryAchieved": grade_result.is_correct,
                "maxAttempts": activity.max_attempts,
                "attemptsRemaining": attempts_remaining,
                "weight": activity.weight,
            }
        })


# ---------------------------------------------------------------------------
# Badges
# ---------------------------------------------------------------------------
class BadgesListView(views.APIView):
    """GET /api/badges — lista insignias con flag earned."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        badges = Badge.objects.order_by("tier", "name")
        earned_map = {}
        for ub in UserBadge.objects.filter(user=user).select_related("badge"):
            earned_map[ub.badge_id] = ub.awarded_at.isoformat()
        return Response({
            "badges": [
                {
                    "id": b.id, "slug": b.slug, "name": b.name,
                    "description": b.description, "icon": b.icon, "tier": b.tier,
                    "earned": b.id in earned_map,
                    "awardedAt": earned_map.get(b.id),
                }
                for b in badges
            ]
        })


class RecentBadgesView(views.APIView):
    """GET /api/recent-badges — últimas 5 insignias en 7 días (notificaciones)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from datetime import timedelta
        threshold = timezone.now() - timedelta(days=7)
        recent = list(
            request.user.user_badges.filter(awarded_at__gte=threshold)
            .select_related("badge").order_by("-awarded_at")[:5]
        )
        return Response({
            "badges": [
                {
                    "id": ub.badge.id,
                    "slug": ub.badge.slug, "name": ub.badge.name,
                    "description": ub.badge.description,
                    "icon": ub.badge.icon, "tier": ub.badge.tier,
                    "awardedAt": ub.awarded_at.isoformat(),
                }
                for ub in recent
            ]
        })


class BadgeProgressView(views.APIView):
    """GET /api/badge-progress — progreso hacia cada insignia."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        from .badges import ECG_UNIT_SLUG, SAFETY_UNIT_SLUG
        from curriculum.models import Unit as UnitModel

        total_correct = (
            user.attempts.filter(correct=True).values("activity_id").distinct().count()
        )
        visited = user.progress.filter(last_visited__isnull=False).count()
        streak = user.streak

        ecg = UnitModel.objects.filter(slug=ECG_UNIT_SLUG).first()
        ecg_mastery = 0
        if ecg:
            try:
                ecg_mastery = user.progress.get(unit=ecg).mastery
            except Progress.DoesNotExist:
                pass

        safety = UnitModel.objects.filter(slug=SAFETY_UNIT_SLUG).first()
        safety_total = Activity.objects.filter(lesson__unit=safety).count() if safety else 0
        safety_completed = 0
        if safety:
            try:
                safety_completed = user.progress.get(unit=safety).completed
            except Progress.DoesNotExist:
                pass

        # Resolver IDs reales de cada badge por slug (la PK puede ser un cuid
        # autogenerado cuando se crea vía seed_demo en vez del fixture).
        slug_to_id = dict(Badge.objects.values_list("slug", "id"))

        raw = [
            ("primer-paso", total_correct, 1, min(100, total_correct * 100), None),
            ("explorador", visited, 5, min(100, visited * 20), None),
            ("racha-7", streak, 7, min(100, round(streak / 7 * 100)), None),
            ("maestro-ecg", ecg_mastery, 80, min(100, round(ecg_mastery / 80 * 100)), "Electrocardiografía (ECG)"),
            ("centinela", safety_completed, safety_total or 7, min(100, round(safety_completed / (safety_total or 7) * 100)) if (safety_total or 7) else 0, None),
        ]
        progress_data = [
            {
                "badgeId": slug_to_id.get(slug, slug),
                "slug": slug,
                "current": current,
                "target": target,
                "pct": pct,
                **({"unitContext": ctx} if ctx else {}),
            }
            for slug, current, target, pct, ctx in raw
        ]
        return Response({"badges": progress_data})


# ---------------------------------------------------------------------------
# Bookmarks
# ---------------------------------------------------------------------------
class BookmarksView(views.APIView):
    """GET/POST/DELETE /api/bookmarks — marcadores de actividad."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        bookmarks = request.user.bookmarks.select_related("activity__lesson__unit").all()
        return Response({
            "bookmarks": [
                {
                    "id": b.id, "activityId": b.activity_id, "note": b.note,
                    "createdAt": b.created_at.isoformat(),
                    "activity": {
                        "id": b.activity.id, "title": b.activity.title,
                        "type": b.activity.type,
                        "difficulty": b.activity.difficulty,
                        "points": b.activity.points,
                        "lesson": {
                            "id": b.activity.lesson.id, "title": b.activity.lesson.title,
                            "unit": {
                                "id": b.activity.lesson.unit.id,
                                "title": b.activity.lesson.unit.title,
                                "color": b.activity.lesson.unit.color,
                                "icon": b.activity.lesson.unit.icon,
                            },
                        },
                    } if b.activity else None,
                }
                for b in bookmarks
            ]
        })

    def post(self, request):
        activity_id = request.data.get("activityId")
        if not activity_id:
            return Response({"error": "Falta activityId"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            activity = Activity.objects.get(pk=activity_id)
        except Activity.DoesNotExist:
            return Response({"error": "Actividad no encontrada"}, status=status.HTTP_404_NOT_FOUND)
        note = (request.data.get("note") or "")[:500]
        bookmark, created = Bookmark.objects.get_or_create(
            user=request.user, activity=activity, defaults={"note": note}
        )
        if not created:
            return Response({"alreadyExists": True, "bookmarkId": bookmark.id})
        return Response({"ok": True, "bookmarkId": bookmark.id}, status=status.HTTP_201_CREATED)

    def delete(self, request):
        activity_id = request.query_params.get("activityId")
        Bookmark.objects.filter(user=request.user, activity_id=activity_id).delete()
        return Response({"ok": True})


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------
class NotificationsView(views.APIView):
    """GET /api/notifications — notificaciones por rol."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from datetime import timedelta
        from .models import ErrorReport

        user = request.user
        notifications = []
        threshold_24h = timezone.now() - timedelta(hours=24)

        if user.is_student:
            # Alarma de uso diario (lineamiento: dependencia tecnológica).
            # Si el estudiante sobrepasa el umbral configurado, se le sugiere
            # una pausa (notificación tipo "info" en la campanita).
            from telemetry.services import check_daily_usage_alert

            usage = check_daily_usage_alert(user)
            if usage["exceeded"]:
                notifications.append({
                    "id": f"usage-{timezone.now().date().isoformat()}",
                    "type": "info",
                    "title": "Uso diario elevado",
                    "description": (
                        f"Llevas {usage['minutesToday']} min hoy "
                        f"(umbral {usage['thresholdMin']} min). Considera tomar un descanso."
                    ),
                    "icon": "AlarmClock",
                    "createdAt": timezone.now().isoformat(),
                    "actionView": "progress",
                })

            # Insignias recientes (7 días)
            threshold_7d = timezone.now() - timedelta(days=7)
            for ub in user.user_badges.filter(awarded_at__gte=threshold_7d).select_related("badge"):
                notifications.append({
                    "id": f"badge-{ub.id}",
                    "type": "badge",
                    "title": ub.badge.name,
                    "description": ub.badge.description,
                    "icon": ub.badge.icon,
                    "createdAt": ub.awarded_at.isoformat(),
                    "actionView": "achievements",
                })
        elif user.is_teacher:
            # Reportes abiertos
            for rep in ErrorReport.objects.filter(status="open").select_related("user"):
                notifications.append({
                    "id": f"report-{rep.id}",
                    "type": "report",
                    "title": f"Reporte de {rep.user.name}",
                    "description": rep.reason,
                    "icon": "Flag",
                    "createdAt": rep.created_at.isoformat(),
                    "actionView": "teacher",
                    "reportId": rep.id,
                })

        unread = sum(1 for n in notifications if n["createdAt"] >= threshold_24h.isoformat())
        return Response({"notifications": notifications, "unreadCount": unread})


