"""
Migración one-time: SQLite (Prisma) → PostgreSQL (Django).

Lee db/custom.db (la DB SQLite con datos del piloto Next.js) y los inserta
en Postgres. Útil para preservar intentos/sesiones reales si ya había uso.

Uso:
    python manage.py import_sqlite --source ../db/custom.db
    python manage.py import_sqlite --source ../db/custom.db --dry-run

Notas:
- Los IDs CUID se conservan (mapeo 1:1).
- Los usuarios se identifican por email; si ya existen, se saltan.
- Es idempotente: re-ejecutar no duplica (usa get_or_create / update_or_create).
"""
import argparse
import sqlite3
import logging

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from curriculum.models import Activity, Lesson, Unit
from learning.models import Attempt, Progress, StudySession, Badge, UserBadge

User = get_user_model()
logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Importa datos desde SQLite (Prisma) a PostgreSQL (Django)."

    def add_arguments(self, parser):
        parser.add_argument("--source", default="../db/custom.db", help="Ruta al SQLite origen")
        parser.add_argument("--dry-run", action="store_true", help="No escribir, solo reportar")

    def handle(self, *args, **options):
        source = options["source"]
        dry_run = options["dry_run"]
        self.stdout.write(f"Importando desde {source} (dry_run={dry_run})...")

        try:
            conn = sqlite3.connect(source)
            conn.row_factory = sqlite3.Row
        except sqlite3.Error as e:
            self.stderr.write(f"No se pudo abrir {source}: {e}")
            return

        cursor = conn.cursor()

        # Mapeo de IDs antiguos → nuevos para cada modelo
        user_map = {}
        unit_map = {}
        lesson_map = {}
        activity_map = {}

        try:
            with transaction.atomic():
                # 1. Usuarios
                self._import_users(cursor, user_map, dry_run)
                # 2. Unidades
                self._import_units(cursor, unit_map, dry_run)
                # 3. Lecciones
                self._import_lessons(cursor, lesson_map, unit_map, dry_run)
                # 4. Actividades
                self._import_activities(cursor, activity_map, lesson_map, dry_run)
                # 5. Intentos
                self._import_attempts(cursor, user_map, activity_map, dry_run)
                # 6. Progreso
                self._import_progress(cursor, user_map, unit_map, dry_run)
                # 7. Sesiones de estudio
                self._import_sessions(cursor, user_map, unit_map, dry_run)
                # 8. Badges (si no están cargados vía fixtures)
                self._import_badges(cursor, dry_run)
        finally:
            conn.close()

        self.stdout.write(self.style.SUCCESS("✅ Importación completa."))

    def _import_users(self, cursor, user_map, dry_run):
        cursor.execute("SELECT * FROM User")
        count = 0
        for row in cursor.fetchall():
            email = row["email"]
            if dry_run:
                count += 1
                continue
            user, _ = User.objects.get_or_create(
                email=email,
                defaults={
                    "username": row["username"] if "username" in row.keys() else email.split("@")[0],
                    "name": row["name"],
                    "role": row["role"],
                    "points": row["points"],
                    "streak": row["streak"],
                    "weekly_goal_min": row["weeklyGoalMin"],
                },
            )
            user_map[row["id"]] = user.id
            count += 1
        self.stdout.write(f"  Usuarios: {count}")

    def _import_units(self, cursor, unit_map, dry_run):
        cursor.execute("SELECT * FROM Unit")
        count = 0
        for row in cursor.fetchall():
            if dry_run:
                count += 1
                continue
            unit, _ = Unit.objects.get_or_create(
                slug=row["slug"],
                defaults={
                    "title": row["title"],
                    "summary": row["summary"],
                    "description": row["description"],
                    "icon": row["icon"],
                    "color": row["color"],
                    "order": row["order"],
                },
            )
            unit_map[row["id"]] = unit.id
            count += 1
        self.stdout.write(f"  Unidades: {count}")

    def _import_lessons(self, cursor, lesson_map, unit_map, dry_run):
        cursor.execute("SELECT * FROM Lesson")
        count = 0
        for row in cursor.fetchall():
            if row["unitId"] not in unit_map:
                continue
            if dry_run:
                count += 1
                continue
            lesson, _ = Lesson.objects.get_or_create(
                unit_id=unit_map[row["unitId"]],
                slug=row["slug"],
                defaults={
                    "title": row["title"],
                    "description": row["description"],
                    "content": row["content"],
                    "duration_min": row["durationMin"],
                    "order": row["order"],
                },
            )
            lesson_map[row["id"]] = lesson.id
            count += 1
        self.stdout.write(f"  Lecciones: {count}")

    def _import_activities(self, cursor, activity_map, lesson_map, dry_run):
        cursor.execute("SELECT * FROM Activity")
        count = 0
        for row in cursor.fetchall():
            if row["lessonId"] not in lesson_map:
                continue
            if dry_run:
                count += 1
                continue
            # data viene como string JSON en SQLite; lo guardamos tal cual
            data_raw = row["data"]
            import json
            try:
                data = json.loads(data_raw) if isinstance(data_raw, str) else data_raw
            except (json.JSONDecodeError, TypeError):
                data = {}
            activity = Activity.objects.create(
                lesson_id=lesson_map[row["lessonId"]],
                type=row["type"],
                title=row["title"],
                prompt=row["prompt"],
                data=data,
                points=row["points"],
                difficulty=row["difficulty"],
                order=row["order"],
                assessment_type=row["assessmentType"] if "assessmentType" in row.keys() else "formative",
                bloom_level=row["bloomLevel"] if "bloomLevel" in row.keys() else "apply",
                max_attempts=row["maxAttempts"] if "maxAttempts" in row.keys() else 3,
            )
            activity_map[row["id"]] = activity.id
            count += 1
        self.stdout.write(f"  Actividades: {count}")

    def _import_attempts(self, cursor, user_map, activity_map, dry_run):
        cursor.execute("SELECT * FROM Attempt")
        count = 0
        for row in cursor.fetchall():
            if row["userId"] not in user_map or row["activityId"] not in activity_map:
                continue
            if dry_run:
                count += 1
                continue
            Attempt.objects.create(
                user_id=user_map[row["userId"]],
                activity_id=activity_map[row["activityId"]],
                answer=row["answer"],
                feedback=row["feedback"] or "",
                score=row["score"],
                correct=row["correct"],
                time_spent=row["timeSpent"],
                hints_used=row["hintsUsed"],
            )
            count += 1
        self.stdout.write(f"  Intentos: {count}")

    def _import_progress(self, cursor, user_map, unit_map, dry_run):
        cursor.execute("SELECT * FROM Progress")
        count = 0
        for row in cursor.fetchall():
            if row["userId"] not in user_map or row["unitId"] not in unit_map:
                continue
            if dry_run:
                count += 1
                continue
            Progress.objects.update_or_create(
                user_id=user_map[row["userId"]],
                unit_id=unit_map[row["unitId"]],
                defaults={
                    "completed": row["completed"],
                    "total": row["total"],
                    "mastery": row["mastery"],
                },
            )
            count += 1
        self.stdout.write(f"  Progresos: {count}")

    def _import_sessions(self, cursor, user_map, unit_map, dry_run):
        cursor.execute("SELECT * FROM StudySession")
        count = 0
        for row in cursor.fetchall():
            if row["userId"] not in user_map:
                continue
            if dry_run:
                count += 1
                continue
            StudySession.objects.create(
                user_id=user_map[row["userId"]],
                unit_id=unit_map.get(row["unitId"]) if row["unitId"] else None,
                duration=row["duration"],
            )
            count += 1
        self.stdout.write(f"  Sesiones: {count}")

    def _import_badges(self, cursor, dry_run):
        if Badge.objects.exists():
            return
        cursor.execute("SELECT * FROM Badge")
        count = 0
        for row in cursor.fetchall():
            if dry_run:
                count += 1
                continue
            Badge.objects.get_or_create(
                slug=row["slug"],
                defaults={
                    "name": row["name"],
                    "description": row["description"],
                    "icon": row["icon"],
                    "tier": row["tier"],
                },
            )
            count += 1
        self.stdout.write(f"  Badges: {count}")
