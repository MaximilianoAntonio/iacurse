# AGENTS.md — Plataforma Electromedicina II

> Este archivo está dirigido a agentes de IA que trabajen en el repositorio.
> Toda la documentación y los comentarios del proyecto están en **español**:
> mantén esa convención en código, comentarios y mensajes dirigidos al usuario.

## Visión general del proyecto

Plataforma de aprendizaje adaptativo para el curso **Electromedicina II**,
desarrollada como Piloto de Innovación Docente de la **Universidad de Valparaíso**.
Es un monorepo con dos aplicaciones:

- **Backend**: Django 5 + Django REST Framework + PostgreSQL 16 (carpeta `backend/`).
- **Frontend**: Next.js 16 (App Router) + React 19 + TypeScript (carpeta `src/`, raíz del repo).

Funcionalidades principales: módulo de acceso **anonimizado** (los estudiantes
entran con un `student_code` único asignado externamente — sin email ni nombre
real en la plataforma; el docente entra con email; no hay registro público),
cambio de contraseña obligatorio en el primer inicio y tras cada reset manual
del docente, currículo con unidades/lecciones/actividades, evaluación automática
con 5 tipos de actividad, **diagnóstico general del curso** (una sola evaluación
obligatoria antes de acceder a las unidades, cuyas respuestas alimentan la
adaptación por IA de cada unidad — `PersonalizedUnit`, on-demand), **prueba de
cierre** configurable por el docente y desbloqueada al completar todas las
unidades, gamificación (puntos, insignias, rachas), retroalimentación automática
con IA (capa abstracta OpenAI/Gemini con fallbacks en español), telemetría
completa (accesos, tiempo de interacción vía heartbeat, eventos), botón flotante
global de reporte de errores presente en todas las vistas, panel docente de
analítica y gestión de estudiantes, más un Course Builder para docentes.

Nota histórica: el proyecto se migró desde una versión original Next.js + Prisma +
SQLite; el backend Django reproduce el schema Prisma (los comentarios lo mencionan
como "parity con Prisma"). Ya no existe Prisma en el repo activo.

## Comandos de build y ejecución

### Todo el stack con Docker (recomendado)

```bash
cp .env.example .env      # ajustar OPENAI_API_KEY / GEMINI_API_KEY y DJANGO_SECRET_KEY
docker compose up --build                                         # producción
docker compose -f docker-compose.yml -f docker-compose.dev.yml up # dev con hot-reload
```

El entrypoint del backend (`backend/entrypoint.sh`) espera a Postgres, ejecuta
`migrate`, `collectstatic` y carga fixtures + `seed_demo` si la DB está vacía.

Servicios: frontend http://localhost:3000 · backend http://localhost:8000 ·
admin Django http://localhost:8000/admin · Postgres localhost:5432.
Health check del backend: `GET /api/health`.

Nota Windows: el override dev define `WATCHPACK_POLLING=true` porque el
bind-mount no propaga eventos de filesystem al contenedor (sin eso el
hot-reload no ve los cambios del host). Si aparecen 404 espurios tras
recrear el contenedor, borra el contenido del volumen `.next`
(`docker run --rm --volumes-from electromed-frontend alpine rm -rf /app/.next`)
y reinicia el frontend.

### Backend sin Docker

```bash
cd backend
python -m venv .venv && pip install -r requirements.txt
# Opción rápida con SQLite (sin Postgres):
DJANGO_SETTINGS_MODULE=config.settings.local python manage.py migrate
DJANGO_SETTINGS_MODULE=config.settings.local python manage.py seed_demo
DJANGO_SETTINGS_MODULE=config.settings.local python manage.py runserver
```

Settings disponibles en `backend/config/settings/`: `base`, `dev`, `prod`,
`local` (SQLite en archivo) y `test` (SQLite en memoria). El entorno se elige
con `DJANGO_SETTINGS_MODULE` o `DJANGO_MODE` (dev|prod) en Docker.

### Frontend sin Docker

```bash
bun install        # o npm install (hay bun.lock; el Dockerfile usa npm)
bun run dev        # next dev -p 3000
bun run build      # next build
bun run lint       # eslint .
```

Crear `.env.local` con `NEXT_PUBLIC_API_URL=http://localhost:8000`.

### Cuentas demo (tras `seed_demo`)

Los estudiantes entran con **código**, no con email:

| Rol | Identificador | Password |
|---|---|---|
| Docente | hermes.mora@uv.cl | demo1234 |
| Estudiante | EM-0001 | demo1234 |
| Estudiante | EM-0002 | demo1234 |

(hay también `EM-0003` y `EM-0004`). Los estudiantes demo tienen
`must_change_password=False` para poder probar directo; las cuentas creadas
por el docente desde el panel (o tras un reset de contraseña) siempre exigen
cambio obligatorio en el primer inicio.

## Estructura del código

### Backend (`backend/`)

Apps Django locales (registradas en `config/settings/base.py`):

| App | Responsabilidad |
|---|---|
| `accounts/` | Usuario custom (`accounts.User`, roles `student`/`teacher`). Login por **identificador único**: si contiene `@` busca por email (docentes), si no por `student_code` (estudiantes, anonimizados: sin email/nombre real). Campos `student_code` y `must_change_password` (cambio obligatorio vía `POST /api/auth/change-password`; gate a pantalla completa en el frontend). **No hay registro público**: el docente crea/resetea estudiantes desde `admin_views.py` (`GET/POST /api/admin/students`, `POST /api/admin/students/<id>/reset-password`, IsTeacher; las contraseñas temporales se muestran una sola vez). `/api/me`, `/api/users` (solo docentes y sin PII de estudiantes) |
| `curriculum/` | Units, Lessons, Activities, Objectives, Rubrics + **`CourseConfig`** (singleton: preguntas del diagnóstico general y configuración de la prueba de cierre — preguntas MCQ, `final_exam_pass_score`, `final_exam_max_attempts`) |
| `learning/` | Attempts, Progress, Badges, Bookmarks, `PersonalizedUnit` (unidad adaptada por IA a partir de las respuestas del **diagnóstico general**; `skipped=True` cuando el estudiante usa "Usar contenido base" — POST `/api/units/<id>` con `{action: "adapt"|"skip"}`), `CourseDiagnosticResult` (diagnóstico general, OneToOne por usuario; si el docente edita las preguntas desde el Course Builder se borran los resultados y los estudiantes lo repiten), `FinalExamAttempt` (prueba de cierre; endpoints `GET/POST /api/course/final-exam`, desbloqueo con `all_units_completed()` de `learning/services.py`, +100 pts al aprobar), `GET /api/course/status` y `POST /api/course/diagnostic` (gate del estudiante). Lógica de negocio en `grading.py` (5 tipos de actividad, umbrales exactos), `badges.py` (5 reglas), `streak.py` (3 branches) |
| `telemetry/` | `AccessLog` (middleware), `StudySession` (heartbeat), `EventLog`, alarma de uso diario |
| `analytics/` | Panel docente y progreso del estudiante (`aggregations.py`) |
| `tutor/` | Capa de abstracción de IA en `tutor/ai/` (`base.py`, `factory.py`, `openai_provider.py`, `gemini_provider.py`, `prompts.py`) + `services.py` con `generate_activity_feedback` (retroalimentación de actividades). El chat socrático (modelo ChatMessage y endpoint `/api/tutor`) fue eliminado del producto |
| `sandbox/` | Course Builder del docente — CRUD admin del currículo live (`/api/admin/units|lessons|activities|objectives|rubrics`, solo docentes), configuración del diagnóstico general (`GET/PATCH /api/admin/course/diagnostic`) y de la prueba de cierre (`GET/PUT /api/admin/course/final-exam`), y `POST /api/uploads` (subida de imágenes para el editor, máx. 5 MB a `MEDIA_ROOT/uploads/`). Sin modelos propios: el flujo sandbox de cursos (Course/QuestionBank/DataResource y `publish_to_curriculum`) fue eliminado del producto |
| `reports/` | Reportes de error (contenido del curso, actividades y `platform` — el botón flotante global). POST abierto a cualquier autenticado; GET/PATCH (moderación) solo docentes vía `accounts.permissions.IsTeacher`. El GET expone `reporterCode` (código) para estudiantes, nunca email/nombre |
| `search/` | Búsqueda global |
| `fixtures/` | Datos seed (badges, etc.); `learning/management/commands/seed_demo.py` genera los datos demo |
| `scripts/` | `import_sqlite.py` — migración de datos desde el SQLite legado |

Todas las rutas de API cuelgan de `/api/` (ver `config/urls.py`), por parity con
el frontend que ya llama a `/api/...` cambiando solo el host base.

### Frontend (`src/`)

- `src/app/` — App Router con una **única página** (`page.tsx`); la app funciona
  como SPA cliente: `view-router.tsx` + el store deciden qué vista renderizar.
  `page.tsx` también aplica los **gates post-login** en orden: cambio de
  contraseña obligatorio (`force-change-password-view`) y, solo estudiantes,
  diagnóstico general del curso (`course-diagnostic-view`, consulta
  `GET /api/course/status`).
- `src/components/views/` — vistas principales (login, dashboard, units,
  unit-detail, lesson, activity, final-exam, teacher, progress, achievements,
  course-builder, about).
- `src/components/app/` — shell de la aplicación (header, sidebar, footer,
  búsqueda global, notificaciones). El sidebar colapsa a un **mini-rail de
  iconos** en desktop (nunca desaparece) y es drawer con overlay en móvil.
  Incluye `global-report-fab.tsx`: botón flotante de reporte (`fixed bottom-6
  right-6 z-40`) montado en `app-shell.tsx` y visible en **todas** las vistas
  autenticadas; envía `source: "platform"` con `sourceId` contextual
  (`page:<view>;unit:<id>;...`). El diálogo es `report-error-dialog.tsx`
  (reutilizable en modo controlado o con trigger propio; también lo usan
  unit-detail y lesson-view con `source: "content"`).
- `src/components/course-builder/` — editor de cursos del docente.
- `src/components/ui/` — componentes shadcn/ui (estilo "new-york", iconos Lucide).
- `src/store/app-store.ts` — estado global con **Zustand** (`persist`), incluye
  auth, navegación sincronizada con la URL (`hydrateFromUrl`) y estado de UI.
- `src/hooks/` — `use-fetch.ts` (fetching + `postJSON`/`putJSON`/`patchJSON`/`deleteURL`),
  `use-telemetry.ts` (heartbeat de sesión), `use-draft-guard.ts` (autosave de
  borradores en `localStorage` + aviso `beforeunload`), `use-toast.ts`,
  `use-mobile.ts`.
- `src/lib/` — `types.ts` (tipos de dominio compartidos), `utils.ts` (`cn`),
  `course-utils.ts`, `markdown-media.tsx` (render de medios en Markdown:
  `resolveMediaSrc` prefija `API_BASE` a rutas `/media/...`, `videoEmbedUrl`
  detecta YouTube/Vimeo y `VideoEmbed` los embebe en 16:9),
  `course-content.tsx` (parsing y render unificado del contenido Markdown de
  unidades/lecciones: `splitContentSections` por H2, `CHECKPOINT_SEPARATOR` +
  `splitCheckpoints`/`parseCheckpointQuestions`, `PROSE_CLASSES` y
  `markdownComponents` compartidos con anclas `slugifyHeading`; lo importan
  `lesson-view` y `unit-detail-view`, y `lesson-toc` re-exporta el slug).
  Las tarjetas de unidad (dashboard y listado) son el componente compartido
  `src/components/views/unit-card.tsx`, con progreso real (completed/total y
  mastery de `GET /api/units`).
- **Editor de contenido docente**: `src/components/ui/markdown-editor.tsx` —
  WYSIWYG basado en **TipTap v2** (`@tiptap/react` + `starter-kit` + `image` +
  `link` + `placeholder` + `tiptap-markdown`). El contrato sigue siendo
  Markdown (`value`/`onChange`): `tiptap-markdown` convierte en ambos sentidos.
  Dentro del editor las imágenes `/media/...` se resuelven contra `API_BASE`
  (helpers `toEditor`/`fromEditor`); en el Markdown persistido quedan
  relativas. Toolbar con formato, listas, citas, código, enlaces, subida de
  imágenes (botón, Ctrl+V o arrastrar), videos YouTube/Vimeo (se embeben al
  publicar), deshacer/rehacer, modo "Markdown" en crudo, pantalla completa y
  contador. Lo usan el Course Builder (`curriculum-tab`), `course-editor` y el
  `lesson-editor-dialog`. Las imágenes se sirven desde el backend bajo
  `/media/` (en dev vía `static()`; en producción Django las sirve con
  `django.views.static.serve` y los estáticos van por WhiteNoise — ver
  "Despliegue").
- **Borradores de lección**: `Lesson.is_published` (default `True`). Los
  borradores solo se ven en el Course Builder (badge "Borrador"); los
  endpoints de estudiante (`/api/units/<id>`, `/api/lessons/<id>`) los
  excluyen. El diálogo de edición tiene "Guardar borrador" vs "Publicar" y
  autosave local en `localStorage` (clave `electromed_lesson_editor_draft_<id>`)
  para retomar la edición sin haber guardado en el servidor.
- **`DESIGN.md`** (raíz) — mundo visual "Instrumento de precisión": tipografías
  Archivo (display) + Hanken Grotesk (texto) + JetBrains Mono (datos, vía
  `next/font` en `layout.tsx`), paleta porcelana/tinta con azul UV `#003366`
  primario y dorado `#F5B800` como señal puntual, tokens de motion
  (`animate-fade-in-up`, `.stagger-children`, `.hover-lift`, `.skeleton`,
  ease `cubic-bezier(0.16,1,0.3,1)`). Léelo antes de tocar UI; los tokens
  viven en `src/app/globals.css` (Tailwind 4, sin `tailwind.config.ts`).

### Flujo de datos frontend ↔ backend

- Base de API: `API_BASE = NEXT_PUBLIC_API_URL || "http://localhost:8000"`
  (`src/hooks/use-fetch.ts`). Las URLs relativas `/api/...` se prefijan con ese host.
- Autenticación por **cookie de sesión Django** (`credentials: "include"` en
  todos los fetch). El login (`POST /api/auth/login`) recibe `{identifier,
  password}`: código de estudiante (`EM-0001`) o email docente. Como la cookie
  es HttpOnly, el frontend guarda un flag `electromed-session` en `localStorage`
  para saber si debe revalidar con `/api/me`. Tras autenticar, `page.tsx`
  aplica los gates de `mustChangePassword` y del diagnóstico general antes de
  montar el `AppShell`.
- **CSRF**: antes de cada POST/PATCH/DELETE se asegura la cookie `csrftoken`
  (GET a `/api/auth/csrf`) y se envía el header `X-CSRFToken`. Usa siempre los
  helpers `postJSON`/`patchJSON`/`deleteURL` en lugar de `fetch` directo.

## Guías de estilo de código

- **Idioma**: español (Chile) en comentarios, docstrings, strings de UI y
  documentación. Identificadores en inglés, como en el código existente.
- **Backend**: Django + DRF estándar; configuración sensible solo vía variables
  de entorno (helpers `env_bool`/`env_list` en `config/settings/base.py`).
  Los módulos cargan `.env` con `python-dotenv`.
- **Frontend**: TypeScript estricto (`strict: true`, aunque `noImplicitAny: false`),
  path alias `@/*` → `./src/*`. Tailwind CSS 4 + shadcn/ui; usa `cn()` de
  `@/lib/utils` para clases condicionales. Componentes con `"use client"` cuando
  usan hooks/estado (casi todo, dado el modelo SPA).
- **ESLint** (`eslint.config.mjs`, flat config con `eslint-config-next`): la
  mayoría de las reglas estrictas están **desactivadas** (`no-explicit-any`,
  `exhaustive-deps`, etc.). El lint no es una barrera fuerte en este repo.
- `next.config.ts`: `output: "standalone"` (para Docker), `ignoreBuildErrors: true`
  y `reactStrictMode: false` — decisiones deliberadas; no las "corrijas" sin
  pedirlo.
- No introducir dependencias nuevas sin confirmar que no exista ya una
  alternativa en `package.json` / `requirements.txt`.

## Testing

Solo el **backend** tiene tests (el frontend no tiene infraestructura de pruebas).

```bash
cd backend
pytest                        # todos los tests (~145)
pytest learning/tests/        # grading / badges / streak / attempt
pytest telemetry/tests/       # telemetría
pytest -v                     # verbose
```

- Configuración en `backend/pytest.ini`: usa `config.settings.test`, que corre
  sobre **SQLite en memoria** (no requiere Postgres), desactiva el middleware de
  telemetría y fuerza `AI_PROVIDER = "fallback"` (sin llamadas reales a IA).
- Framework: `pytest` + `pytest-django`.
- Al modificar `learning/grading.py`, `badges.py` o `streak.py`, los tests
  correspondientes en `learning/tests/` deben seguir pasando; cubren umbrales
  exactos y orden de side-effects del endpoint de attempt.

## Consideraciones de seguridad

- **Secretos**: nunca commitear `.env`. `DJANGO_SECRET_KEY`, `OPENAI_API_KEY`,
  `GEMINI_API_KEY` y credenciales de Postgres se leen de variables de entorno
  (ver `.env.example`). El valor por defecto `dev-insecure-key-change-in-prod`
  es solo para desarrollo.
- **Autenticación**: sesiones Django por cookie HttpOnly (`SessionAuthentication`),
  `SESSION_COOKIE_AGE` de 7 días; en producción activar `SESSION_COOKIE_SECURE`
  y `CSRF_COOKIE_SECURE`. El login usa un identificador único: email para
  docentes (`@uv.cl`), `student_code` para estudiantes — **los estudiantes son
  anónimos dentro de la plataforma** (sin email ni nombre real; la tabla que
  mapea código ↔ identidad se mantiene fuera del sistema). No existe registro
  público: solo el docente crea cuentas (`/api/admin/students`) y resetea
  contraseñas; toda contraseña temporal fuerza cambio obligatorio
  (`must_change_password`).
- **CORS/CSRF**: orígenes permitidos en `CORS_ALLOWED_ORIGINS` y
  `CSRF_TRUSTED_ORIGINS` (default: localhost:3000); `CORS_ALLOW_CREDENTIALS=True`
  es necesario para las cookies cross-origin. Restringir en producción.
- **DRF**: por defecto todos los endpoints exigen `IsAuthenticated`
  (ver `REST_FRAMEWORK` en `base.py`). No relajar este default sin razón.
  Además, la gestión de contenido (todo `sandbox/` — Course Builder y CRUD
  `/api/admin/*`), la gestión de estudiantes (`/api/admin/students*`),
  la configuración de evaluaciones (`/api/admin/course/*`), la moderación de
  reportes y la analítica docente (`/api/teacher`, `/api/teacher/student/<id>`,
  `/api/users`) exigen el permiso `accounts.permissions.IsTeacher` (rol docente).
  La analítica y los reportes identifican estudiantes solo por `studentCode`.
- **IA**: las API keys nunca se exponen al frontend; si falta la key, los
  servicios usan fallbacks en español en vez de fallar. El provider `openai`
  acepta `OPENAI_BASE_URL` para APIs OpenAI-compatibles (p. ej. Kimi/Moonshot
  con `https://api.kimi.com/coding/v1` y `AI_MODEL=kimi-for-coding`).
- La telemetría registra datos de uso por usuario autenticado; tenerlo en
  cuenta al manipular `AccessLog`/`StudySession`/`EventLog`.

## Despliegue

- **Guía completa**: `DEPLOY.md` (variables obligatorias, cookies según
  HTTPS/HTTP, verificación, respaldos, **costos estimados de VPS**).
- **Producción**: `docker compose up --build` — Postgres 16 + gunicorn
  (3 workers, `config.wsgi:application`) + Next.js standalone
  (`Dockerfile.frontend` multi-etapa: deps → build → runtime con
  `node server.js`; la imagen final no incluye `node_modules` completo).
- **Estáticos y media en prod**: WhiteNoise sirve `/static/` desde gunicorn
  (middleware + `CompressedManifestStaticFilesStorage` en
  `config/settings/prod.py`); `/media/` lo sirve Django vía
  `django.views.static.serve` en `config/urls.py` (el stack MVP no incluye
  nginx). Las subidas de docentes persisten en el volumen `media_data`.
- **Cookies en prod**: `prod.py` las toma del entorno con default seguro
  (`SECURE=1`, `SAMESITE=None`). En despliegues HTTP sin TLS hay que definir
  `SESSION_COOKIE_SECURE=0`/`CSRF_COOKIE_SECURE=0`/`SAMESITE=Lax` o el login
  no persiste (ver `DEPLOY.md`).
- **Contextos de build**: `.dockerignore` (raíz) y `backend/.dockerignore`
  excluyen `.env`, `.git`, `node_modules`, `.next`, `.venv`, `media/` y
  `staticfiles/` — no los elimines del ignore (riesgo de secretos en imagen).
- **Desarrollo con hot-reload**: override `docker-compose.dev.yml`
  (runserver + `next dev`, monta el código como volumen).
- Migración de datos desde el SQLite legado:
  `python manage.py import_sqlite --source ../db/custom.db`.
