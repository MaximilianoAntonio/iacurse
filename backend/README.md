# Backend Django — Plataforma Electromedicina II

Piloto de Innovación Docente · Universidad de Valparaíso

Backend Python (Django + DRF) con PostgreSQL, IA generativa y telemetría completa, conforme a los lineamientos del proyecto (Sección 12 del formulario de postulación).

## Cumplimiento de lineamientos

| Lineamiento (Sección 12) | Implementación |
|---|---|
| **Backend: Python (Django o Flask)** | ✅ Django 5 + Django REST Framework |
| **Base de datos: PostgreSQL/MySQL** | ✅ PostgreSQL 16 |
| **Módulo de acceso: registro y autenticación** | ✅ `accounts/` — login/registro/logout por sesión |
| **IA generativa con retroalimentación** | ✅ `tutor/ai/` — capa abstracta OpenAI/Gemini configurable |
| **Panel docente con telemetría** | ✅ `analytics/` consumiendo `telemetry/` |
| **Número de accesos** | ✅ `AccessLog` (middleware) |
| **Tiempo de interacción** | ✅ `StudySession` escrito vía heartbeat real |
| **Actividades completadas** | ✅ `Progress.completed` |
| **Frecuencia de uso** | ✅ Derivada de `AccessLog` + `StudySession` |
| **Endpoint genérico de eventos** | ✅ `POST /api/telemetry/event` |

## Inicio rápido (Docker)

```bash
# 1. Configurar variables de entorno
cp .env.example .env
# Editar .env: definir OPENAI_API_KEY (o GEMINI_API_KEY) y SECRET_KEY

# 2. Levantar todo (PostgreSQL + Django + Next.js)
docker compose up --build

# 3. El entrypoint ejecuta automáticamente:
#    - migrate
#    - collectstatic
#    - seed_demo (si la DB está vacía)
```

Servicios:
- **Frontend:** http://localhost:3000
- **Backend Django:** http://localhost:8000
- **Admin Django:** http://localhost:8000/admin
- **PostgreSQL:** localhost:5432

## Inicio rápido (sin Docker, desarrollo local)

### Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/Mac: source .venv/bin/activate
pip install -r requirements.txt

# Crear backend/.env (ver .env.example) apuntando a Postgres local
# O usar SQLite para pruebas rápidas:
#   DJANGO_SETTINGS_MODULE=config.settings.local python manage.py migrate
#   DJANGO_SETTINGS_MODULE=config.settings.local python manage.py seed_demo
#   DJANGO_SETTINGS_MODULE=config.settings.local python manage.py runserver

python manage.py migrate
python manage.py seed_demo
python manage.py runserver
```

### Frontend

```bash
# Desde la raíz del repo
bun install   # o npm install
# Crear .env.local con:
#   NEXT_PUBLIC_API_URL=http://localhost:8000
bun run dev
```

## Cuentas demo

| Rol | Email | Password |
|---|---|---|
| Docente | hermes.mora@uv.cl | demo1234 |
| Estudiante | camila.rojas@uv.cl | demo1234 |
| Estudiante | matias.soto@uv.cl | demo1234 |
| Estudiante | francisca.diaz@uv.cl | demo1234 |
| Estudiante | ignacio.munoz@uv.cl | demo1234 |

## Arquitectura

```
backend/
├── config/          # Settings Django (base/dev/prod/test/local)
├── accounts/        # Auth: login, registro, /me, /users (Módulo de acceso)
├── curriculum/      # Units, Lessons, Activities, Objectives, Rubrics
├── learning/        # Attempts, Progress, Badges, Bookmarks
│   ├── grading.py   # ⚙️ Lógica de evaluación (5 tipos, umbrales exactos)
│   ├── badges.py    # ⚙️ 6 reglas de insignias
│   └── streak.py    # ⚙️ Lógica de racha (3 branches)
├── telemetry/       # ⚠️ NUEVO: AccessLog, EventLog, StudySession real
│   ├── middleware.py
│   └── services.py  # start/heartbeat/end sesión
├── analytics/       # Panel Docente + progreso estudiante
├── tutor/           # IA socrática + retroalimentación
│   └── ai/          # Capa abstracta OpenAI/Gemini
├── sandbox/         # Course Builder (docente)
├── reports/         # Reportes de error de IA
├── search/          # Búsqueda global
├── fixtures/        # Datos seed (badges, unidades, usuarios)
└── scripts/         # Migración SQLite→Postgres
```

## IA generativa (capa abstracta configurable)

El proveedor se elige con `AI_PROVIDER` en `.env`:

- `openai` (default): usa `openai` SDK con modelo `AI_MODEL` (default `gpt-4o-mini`)
- `gemini`: usa `google-generativeai` con `GEMINI_MODEL`
- Si no hay API key configurada, los servicios usan **fallbacks** en español (no bloquean el piloto)

## Telemetría — métricas del lineamiento

La diferencia clave respecto a la versión Next.js original: `StudySession` ahora
se escribe en **producción** vía heartbeat del frontend (antes solo existía en seed).

- **AccessLog** (middleware): cada request autenticada → "Número de accesos"
- **StudySession** (heartbeat cada 30s): "Tiempo de interacción"
- **EventLog** (`POST /api/telemetry/event`): eventos arbitrarios para analítica
- **Alarma de uso diario**: `/api/telemetry/usage` (umbral configurable)

## Tests

```bash
cd backend
pytest                          # todos los tests
pytest learning/tests/          # solo lógica de negocio (grading/badges/streak)
pytest telemetry/tests/         # solo telemetría
pytest -v                       # verbose
```

Cobertura actual: **56 tests** que validan grading (5 tipos), badges (6 reglas), streak (3 branches), endpoint attempt (orden de side-effects), y telemetría completa.

## Migración desde SQLite (datos existentes)

```bash
python manage.py import_sqlite --source ../db/custom.db
```

Ver `scripts/import_sqlite.py`.
