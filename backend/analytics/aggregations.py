"""
Agregaciones para el Panel Docente y progreso del estudiante.

Reproduce la lógica de src/app/api/teacher/route.ts, teacher/student/[id]/route.ts,
progress/route.ts — ahora con StudySession REAL (no solo seed).

Métricas del lineamiento:
- Número de accesos → AccessLog
- Tiempo de interacción → StudySession.duration (escrito vía heartbeat real)
- Actividades completadas → Progress.completed
- Frecuencia de uso → derivada de AccessLog + StudySession
"""
from datetime import timedelta
from collections import defaultdict

from django.db.models import Count, Sum
from django.utils import timezone

from accounts.models import User
from curriculum.models import Unit
from learning.models import Attempt, Progress, SelfAssessment, StudySession
from telemetry.models import AccessLog


def student_progress_analytics(user: User) -> dict:
    """Analítica del propio estudiante (progress/route.ts).

    Incluye activityByDay (14 días), byType, byDifficulty, stats, sesiones y
    selfAssess (autoevaluaciones metacognitivas).
    """
    progress_rows = list(
        Progress.objects.filter(user=user).select_related("unit").order_by("unit__order")
    )
    attempts = list(
        Attempt.objects.filter(user=user)
        .select_related("activity__lesson__unit")
        .order_by("-created_at")[:60]
    )
    sessions = list(
        StudySession.objects.filter(user=user).order_by("-started_at")[:30]
    )
    self_assess = list(
        SelfAssessment.objects.filter(user=user).select_related("unit").order_by("-created_at")[:50]
    )

    # activityByDay (14 días)
    now = timezone.now()
    days = []
    for i in range(13, -1, -1):
        day = (now - timedelta(days=i)).date()
        day_attempts = [a for a in attempts if a.created_at.date() == day]
        day_sessions = [s for s in sessions if s.started_at.date() == day]
        session_sec = sum(s.duration for s in day_sessions)
        days.append({
            "date": day.isoformat(),
            "attempts": len(day_attempts),
            "correct": sum(1 for a in day_attempts if a.correct),
            "timeMin": session_sec // 60,
        })

    # byType y byDifficulty
    by_type = defaultdict(lambda: {"total": 0, "correct": 0})
    by_difficulty = defaultdict(lambda: {"total": 0, "correct": 0})
    for a in attempts:
        if a.activity is None:
            continue
        by_type[a.activity.type]["total"] += 1
        if a.correct:
            by_type[a.activity.type]["correct"] += 1
        by_difficulty[a.activity.difficulty]["total"] += 1
        if a.correct:
            by_difficulty[a.activity.difficulty]["correct"] += 1

    total_session_sec = sum(s.duration for s in sessions)
    total_attempts = len(attempts)
    correct_count = sum(1 for a in attempts if a.correct)
    scores = [a.score for a in attempts if a.score is not None]

    return {
        "user": {
            "id": user.id, "name": user.name, "points": user.points,
            "streak": user.streak,
        },
        "progress": [
            {
                "unitId": p.unit.id,
                "unit": {
                    "id": p.unit.id, "title": p.unit.title,
                    "color": p.unit.color, "icon": p.unit.icon, "slug": p.unit.slug,
                },
                "completed": p.completed, "total": p.total, "mastery": p.mastery,
                "lastVisited": p.last_visited.isoformat() if p.last_visited else None,
            }
            for p in progress_rows
        ],
        "attempts": [
            {
                "id": a.id, "correct": a.correct, "score": a.score,
                "timeSpent": a.time_spent, "createdAt": a.created_at.isoformat(),
                "activity": {
                    "id": a.activity.id, "title": a.activity.title,
                    "type": a.activity.type, "difficulty": a.activity.difficulty,
                    "lesson": {
                        "id": a.activity.lesson.id, "title": a.activity.lesson.title,
                        "unit": {
                            "id": a.activity.lesson.unit.id,
                            "title": a.activity.lesson.unit.title,
                            "color": a.activity.lesson.unit.color,
                        },
                    },
                } if a.activity else None,
            }
            for a in attempts
        ],
        "sessions": [
            {
                "id": s.id, "duration": s.duration,
                "startedAt": s.started_at.isoformat(), "unitId": s.unit_id,
            }
            for s in sessions
        ],
        "activityByDay": days,
        "selfAssess": [
            {
                "id": sa.id, "confidence": sa.confidence,
                "reflection": sa.reflection, "unitId": sa.unit_id,
                "createdAt": sa.created_at.isoformat(),
            }
            for sa in self_assess
        ],
        "byType": dict(by_type),
        "byDifficulty": dict(by_difficulty),
        "stats": {
            "totalAttempts": total_attempts,
            "correctRate": round(correct_count / total_attempts * 100) if total_attempts else 0,
            "totalTimeMin": total_session_sec // 60,
            "avgScore": round(sum(scores) / len(scores)) if scores else 0,
        },
    }


def teacher_dashboard(unit_filter=None) -> dict:
    """Métricas agregadas de todos los estudiantes (teacher/route.ts).

    Ahora con StudySession real (tiempo de interacción) y AccessLog (accesos).
    """
    students = list(
        User.objects.filter(role=User.ROLE_STUDENT).order_by("student_code")
    )
    units = list(Unit.objects.order_by("order"))

    students_data = []
    for s in students:
        progress_q = Progress.objects.filter(user=s)
        if unit_filter:
            progress_q = progress_q.filter(unit_id=unit_filter)
        progress = list(progress_q.select_related("unit"))

        attempts = list(s.attempts.all())
        correct_activities = (
            s.attempts.filter(correct=True).values("activity_id").distinct().count()
        )
        sessions = list(s.study_sessions.all())
        access_count = s.access_logs.count()

        total_time_min = sum(sess.duration for sess in sessions) // 60
        last_active = None
        if sessions:
            last_active = max(sess.started_at for sess in sessions)
        elif s.last_active:
            last_active = s.last_active

        scores = [a.score for a in attempts if a.score is not None]
        hints = [a.hints_used for a in attempts]

        students_data.append({
            # Estudiantes anonimizados: se identifican solo por su código
            "id": s.id, "studentCode": s.student_code, "avatar": s.avatar or "",
            "points": s.points, "streak": s.streak,
            "progressByUnit": [
                {
                    "unitId": p.unit.id, "unitTitle": p.unit.title,
                    "unitColor": p.unit.color,
                    "completed": min(p.completed, p.total),
                    "total": p.total, "mastery": min(100, p.mastery),
                }
                for p in progress
            ],
            "totalAttempts": len(attempts),
            "correctAttempts": sum(1 for a in attempts if a.correct),
            "completedActivities": correct_activities,
            "totalTimeMin": total_time_min,
            "accessCount": access_count,  # NUEVO: número de accesos
            "lastActive": last_active.isoformat() if last_active else None,
            "avgScore": round(sum(scores) / len(scores)) if scores else 0,
            "totalHintsUsed": sum(hints),
        })

    # Agregados
    aggregate = {
        "totalStudents": len(students),
        "totalAttempts": sum(sd["totalAttempts"] for sd in students_data),
        "avgMasteryByUnit": [
            {
                "unitId": u.id, "unitTitle": u.title, "unitColor": u.color,
                "avgMastery": (
                    lambda recs: round(sum(r["mastery"] for r in recs) / len(recs))
                    if recs else 0
                )([
                    pbu for sd in students_data
                    for pbu in sd["progressByUnit"]
                    if pbu["unitId"] == u.id
                ]),
            }
            for u in units
        ],
        "totalStudyHours": sum(sd["totalTimeMin"] for sd in students_data) // 60,
        "totalAccesses": sum(sd["accessCount"] for sd in students_data),  # NUEVO
    }

    return {
        "students": students_data,
        "units": [
            {"id": u.id, "title": u.title, "color": u.color, "icon": u.icon, "slug": u.slug}
            for u in units
        ],
        "aggregate": aggregate,
    }


def student_detail(student: User) -> dict:
    """Detalle profundo de un estudiante (teacher/student/[id]/route.ts)."""
    progress = list(student.progress.select_related("unit").all())
    attempts = list(student.attempts.select_related("activity__lesson__unit").all())
    sessions = list(student.study_sessions.order_by("-started_at")[:20].all())
    badges = list(student.user_badges.select_related("badge").all())
    accesses = student.access_logs.count()

    # Agrupar intentos por actividad
    by_activity = defaultdict(list)
    for a in attempts:
        if a.activity:
            by_activity[a.activity].append(a)

    activities_breakdown = []
    for act, act_attempts in by_activity.items():
        scores = [x.score for x in act_attempts if x.score is not None]
        best_score = max(scores) if scores else 0
        activities_breakdown.append({
            "activity": {
                "id": act.id, "title": act.title, "type": act.type,
                "difficulty": act.difficulty, "points": act.points,
                "lesson": {
                    "id": act.lesson.id, "title": act.lesson.title,
                    "unit": {
                        "id": act.lesson.unit.id, "title": act.lesson.unit.title,
                        "color": act.lesson.unit.color, "icon": act.lesson.unit.icon,
                    },
                },
            },
            "attempts": [
                {
                    "id": x.id, "correct": x.correct, "score": x.score or 0,
                    "timeSpent": x.time_spent,
                    "createdAt": x.created_at.isoformat(),
                }
                for x in sorted(act_attempts, key=lambda a: a.created_at)
            ],
            "bestScore": best_score,
            "correct": any(x.correct for x in act_attempts),
            "totalAttempts": len(act_attempts),
            "totalTime": sum(x.time_spent or 0 for x in act_attempts),
            "totalHints": sum(x.hints_used for x in act_attempts),
            "lastAttempt": (
                max(a.created_at for a in act_attempts).isoformat() if act_attempts else None
            ),
        })

    scores_all = [a.score for a in attempts if a.score is not None]
    correct_attempts = sum(1 for a in attempts if a.correct)
    activities_attempted = len(by_activity)
    activities_correct = sum(1 for act_attempts in by_activity.values()
                              if any(x.correct for x in act_attempts))
    total_hints_used = sum(a.hints_used for a in attempts)

    return {
        "student": {
            "id": student.id, "studentCode": student.student_code,
            "avatar": student.avatar or None,
            "points": student.points, "streak": student.streak,
            "lastActive": student.last_active.isoformat() if student.last_active else None,
            "createdAt": student.created_at.isoformat(),
        },
        "progress": [
            {
                "unitId": p.unit.id,
                "unit": {
                    "id": p.unit.id, "title": p.unit.title, "color": p.unit.color,
                    "icon": p.unit.icon, "slug": p.unit.slug, "order": p.unit.order,
                },
                "completed": p.completed, "total": p.total, "mastery": p.mastery,
                "lastVisited": p.last_visited.isoformat() if p.last_visited else None,
            }
            for p in progress
        ],
        "activities": activities_breakdown,
        "sessions": [
            {"id": s.id, "duration": s.duration, "startedAt": s.started_at.isoformat()}
            for s in sessions
        ],
        "accessCount": accesses,  # NUEVO: número de accesos
        "badges": [
            {"id": b.badge.id, "slug": b.badge.slug, "name": b.badge.name,
             "icon": b.badge.icon, "tier": b.badge.tier,
             "awardedAt": b.awarded_at.isoformat()}
            for b in badges
        ],
        "stats": {
            "totalAttempts": len(attempts),
            "correctAttempts": correct_attempts,
            "totalActivitiesAttempted": activities_attempted,
            "totalActivitiesCorrect": activities_correct,
            "totalTimeMin": sum(s.duration for s in sessions) // 60,
            "avgScore": round(sum(scores_all) / len(scores_all)) if scores_all else 0,
            "totalHintsUsed": total_hints_used,
        },
    }
