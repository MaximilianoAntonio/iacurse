"""
Management command: seed_demo

Crea datos demo para el piloto de Electromedicina II:
- Usuarios: Prof. Hermes Mora (teacher) + 4 estudiantes @uv.cl
- Unidades temáticas (5): Bioseñales, ECG, Monitoreo, Terapéutico, Seguridad
- Lecciones y actividades de ejemplo (por unidad)

Uso:
    python manage.py seed_demo
    python manage.py seed_demo --reset   # borra y recrear
"""
import random
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from curriculum.models import Activity, Lesson, Unit
from learning.models import Badge, StudySession

User = get_user_model()

UNITS_DATA = [
    {
        "slug": "biosenales",
        "title": "Bioseñales y Electrodos",
        "icon": "Activity",
        "color": "sky",
        "summary": "Biopotenciales, electrólito-piel, polarización e impedancia.",
        "lessons": [
            {"title": "Biopotenciales y naturaleza de las señales", "duration": 15},
            {"title": "Interfaz electrodo-piel e impedancia", "duration": 20},
        ],
    },
    {
        "slug": "electrocardiografia",
        "title": "Electrocardiografía",
        "icon": "HeartPulse",
        "color": "rose",
        "summary": "Einthoven, derivaciones, filtrado e interpretación del ECG.",
        "lessons": [
            {"title": "Triángulo de Einthoven y derivaciones", "duration": 20},
            {"title": "Filtrado y artefactos en el ECG", "duration": 15},
        ],
    },
    {
        "slug": "monitoreo-pacientes",
        "title": "Monitoreo de Pacientes",
        "icon": "MonitorDot",
        "color": "amber",
        "summary": "Pulsioximetría, NIBP y capnografía.",
        "lessons": [
            {"title": "Pulsioximetría y curva pletismográfica", "duration": 15},
        ],
    },
    {
        "slug": "equipos-terapeuticos",
        "title": "Equipos Terapéuticos",
        "icon": "Zap",
        "color": "violet",
        "summary": "Desfibriladores, marcapasos y electrocirugía.",
        "lessons": [
            {"title": "Desfibriladores y energía de descarga", "duration": 20},
        ],
    },
    {
        "slug": "seguridad-electrica",
        "title": "Seguridad Eléctrica Clínica",
        "icon": "ShieldCheck",
        "color": "emerald",
        "summary": "Corrientes de fuga, sistemas aislados y norma IEC 60601.",
        "lessons": [
            {"title": "Corrientes de fuga y sistemas aislados", "duration": 20},
            {"title": "Norma IEC 60601 y pruebas de seguridad", "duration": 15},
        ],
    },
]


def _make_activity(lesson, order, atype, title, prompt, data, points=10):
    return Activity.objects.create(
        lesson=lesson, type=atype, title=title, prompt=prompt,
        data=data, points=points, order=order,
    )


class Command(BaseCommand):
    help = "Crea datos demo del piloto Electromedicina II (usuarios, unidades, actividades)."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Borra datos existentes antes de sembrar.")

    def handle(self, *args, **options):
        reset = options["reset"]
        if reset:
            self.stdout.write("Borrando datos existentes...")
            StudySession.objects.all().delete()
            Activity.objects.all().delete()
            Lesson.objects.all().delete()
            Unit.objects.all().delete()
            User.objects.filter(is_superuser=False).delete()

        # --- Usuarios demo ---
        # Forzamos siempre una password usable (es un seed demo).
        teacher, _ = User.objects.get_or_create(
            email="hermes.mora@uv.cl",
            defaults={
                "username": "hermes.mora",
                "name": "Prof. Hermes Mora",
                "role": User.ROLE_TEACHER,
                "is_staff": True,
            },
        )
        teacher.set_password("demo1234")
        teacher.save()

        students_data = [
            ("camila.rojas@uv.cl", "Camila Rojas"),
            ("matias.soto@uv.cl", "Matías Soto"),
            ("francisca.diaz@uv.cl", "Francisca Díaz"),
            ("ignacio.munoz@uv.cl", "Ignacio Muñoz"),
        ]
        students = []
        for email, name in students_data:
            s, _ = User.objects.get_or_create(
                email=email,
                defaults={
                    "username": email.split("@")[0],
                    "name": name,
                    "role": User.ROLE_STUDENT,
                },
            )
            s.set_password("demo1234")
            s.save()
            students.append(s)

        self.stdout.write(self.style.SUCCESS(f"Usuarios: 1 docente + {len(students)} estudiantes."))

        # --- Unidades, lecciones, actividades ---
        if Unit.objects.exists() and not reset:
            self.stdout.write("Las unidades ya existen. Usa --reset para recrear.")
        else:
            for idx, ud in enumerate(UNITS_DATA):
                unit = Unit.objects.create(
                    slug=ud["slug"], title=ud["title"], icon=ud["icon"],
                    color=ud["color"], summary=ud["summary"],
                    description=ud["summary"], order=idx,
                )
                for li, ld in enumerate(ud["lessons"]):
                    lesson = Lesson.objects.create(
                        unit=unit,
                        slug=f"{ud['slug']}-l{li+1}",
                        title=ld["title"],
                        description=ld["title"],
                        content=f"# {ld['title']}\n\nContenido de ejemplo para {ud['title']}.",
                        duration_min=ld["duration"],
                        order=li,
                    )
                    # Una actividad multiple_choice por lección
                    _make_activity(
                        lesson, 0, "multiple_choice",
                        f"Conceptos de {ld['title'][:20]}",
                        f"¿Cuál es correcto sobre {ld['title'].lower()}?",
                        {
                            "question": f"Pregunta sobre {ld['title']}",
                            "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
                            "correctIndex": idx % 4,
                            "explanation": "Explicación de ejemplo.",
                            "hints": ["Pista 1"],
                        },
                    )
            self.stdout.write(self.style.SUCCESS(
                f"Creadas {len(UNITS_DATA)} unidades con lecciones y actividades."
            ))

        # --- Insignias (si no están cargadas vía fixtures) ---
        if not Badge.objects.exists():
            badges_data = [
                ("primer-paso", "Primer Paso", "Footprints", "bronze"),
                ("explorador", "Explorador", "Compass", "bronze"),
                ("racha-7", "Constancia", "Flame", "silver"),
                ("maestro-ecg", "Maestro del ECG", "Award", "gold"),
                ("centinela", "Centinela", "ShieldCheck", "silver"),
                ("tutor-activo", "Curioso", "MessageCircleQuestion", "silver"),
            ]
            for slug, name, icon, tier in badges_data:
                Badge.objects.create(slug=slug, name=name, icon=icon, tier=tier)
            self.stdout.write(self.style.SUCCESS("Creadas 6 insignias canónicas."))

        # --- Sesiones de estudio demo (para que el Panel Docente muestre datos) ---
        if not StudySession.objects.exists() and students:
            now = timezone.now()
            for s in students:
                units = list(Unit.objects.all())
                for day_offset in range(7):
                    if random.random() < 0.7:  # 70% de días activos
                        unit = random.choice(units) if units else None
                        StudySession.objects.create(
                            user=s, unit=unit, duration=random.randint(600, 3600),
                            started_at=now - timedelta(days=day_offset, hours=random.randint(0, 8)),
                            is_active=False, ended_at=now - timedelta(days=day_offset),
                        )
            self.stdout.write(self.style.SUCCESS("Creadas sesiones de estudio demo."))

        self.stdout.write(self.style.SUCCESS("\n✅ Seed demo completo."))
        self.stdout.write("  Login docente:   hermes.mora@uv.cl / demo1234")
        self.stdout.write("  Login estudiante: camila.rojas@uv.cl / demo1234")
