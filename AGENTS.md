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
entran con un `student_code` único — elegido por el docente o generado de
forma aleatoria por la plataforma al crear la cuenta — sin email ni nombre
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
`migrate`, `collectstatic` y —**solo en dev/debug o con `LOAD_DEMO_DATA=1`**—
carga fixtures + `seed_demo` si la DB está vacía. En producción el seed está
bloqueado (las cuentas demo tienen contraseñas públicas del repo); la primera
cuenta docente se crea manualmente (ver `DEPLOY.md`).

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
`must_change_password=False` y el **consentimiento informado pre-registrado**
(autorizado, con segundo código de investigación) para poder probar directo
sin pasar por el gate de consentimiento; las cuentas creadas
por el docente desde el panel (o tras un reset de contraseña) siempre exigen
cambio obligatorio en el primer inicio y registrar su decisión de
consentimiento.

## Estructura del código

### Backend (`backend/`)

Apps Django locales (registradas en `config/settings/base.py`):

| App | Responsabilidad |
|---|---|
| `accounts/` | Usuario custom (`accounts.User`, roles `student`/`teacher`). Login por **identificador único**: si contiene `@` busca por email (docentes), si no por `student_code` (estudiantes, anonimizados: sin email/nombre real). El login (`POST /api/auth/login`) exige **captcha autoalojado** (django-simple-captcha, operación matemática: el frontend pide el desafío a `GET /api/captcha/refresh/` — header `X-Requested-With: XMLHttpRequest` requerido — y envía `captchaKey`/`captchaValue`; `CaptchaStore` de un solo uso, `LOGIN_CAPTCHA_ENABLED` como kill switch), tiene **rate limit** por IP (`ScopedRateThrottle`, scope `login`, `LOGIN_THROTTLE_RATE`, default `5/min` → 429) y **auditoría** de intentos exitosos/fallidos (`telemetry.AuditLog`). Campos `student_code` y `must_change_password` (cambio obligatorio vía `POST /api/auth/change-password`; gate a pantalla completa en el frontend). **No hay registro público**: el docente crea/resetea estudiantes desde `admin_views.py` (`GET/POST /api/admin/students`, `POST /api/admin/students/<id>/reset-password`, IsTeacher; el POST acepta `codes` — códigos explícitos elegidos por el docente — o `count` — N códigos generados de forma totalmente aleatoria: 10 caracteres, mayúsculas+dígitos sin ambiguos, no enumerables —; las contraseñas temporales se muestran una sola vez). `GET /api/me` y `GET /api/me/data` (exportación completa de datos del titular — derecho de acceso/portabilidad Ley 21.719) |
| `curriculum/` | Units, Lessons, Activities, Objectives, Rubrics + **`CourseConfig`** (singleton: preguntas del diagnóstico general y configuración de la prueba de cierre — preguntas MCQ, `final_exam_pass_score`, `final_exam_max_attempts`) |
| `learning/` | Attempts, Progress, Badges, Bookmarks, `PersonalizedUnit` (unidad adaptada por IA a partir de las respuestas del **diagnóstico general**; `skipped=True` cuando el estudiante usa "Continuar sin personalizar" — POST `/api/units/<id>` con `{action: "adapt"|"skip"}`; el contenido base de la unidad ya no se muestra al estudiante, solo el adaptado por IA; el prompt de adaptación (`learning/ai_services.py`) instruye Markdown enriquecido — tablas GFM, fórmulas KaTeX `$...$`/`$$...$$`, callouts `[!tipo]`, bloques repaso/glosario — manteniendo intactos el separador `## 🔍 Preguntas de Control` y el fallback al contenido base), `CourseDiagnosticResult` (diagnóstico general, OneToOne por usuario; si el docente edita las preguntas desde el Course Builder se borran los resultados y los estudiantes lo repiten), `FinalExamAttempt` (prueba de cierre; endpoints `GET/POST /api/course/final-exam`, desbloqueo con `all_units_completed()` de `learning/services.py`, +100 pts al aprobar), `GET /api/course/status` y `POST /api/course/diagnostic` (gate del estudiante; el status también expone el bloque `consent` solo a estudiantes), **`StudentConsent`** (consentimiento informado electrónico para el uso científico de datos, OneToOne: decisión `authorized`/`rejected`, `version` del documento — settings `CONSENT_VERSION` —, `decided_at`, `revoked_at` y `research_code` — **segundo código** `RX-…` generado solo al autorizar; la decisión se registra una sola vez vía `POST /api/course/consent` y el retiro vía `POST /api/course/consent/revoke`, con plazo `CONSENT_REVOKE_DEADLINE`; **el profesor nunca conoce la decisión**: ningún endpoint docente la expone — el listado de estudiantes, la analítica y los reportes no la incluyen — y el `research_code` jamás sale al frontend; el canal del coinvestigador es el admin de Django — `learning/admin.py`, solo lectura, restringir cuentas staff — y el comando `manage.py export_research_data --kind consent|mapping|scientific`, que genera los CSV de la ficha de datos: registro de consentimiento §3.2, tabla de correspondencia §3.3 y base científica §3.4 — esta última solo con autorización vigente y solo bajo el segundo código). Lógica de negocio en `grading.py` (5 tipos de actividad, umbrales exactos — incluye `sanitize_activity_data`, que quita la pauta del payload de `GET /api/lessons/<id>`; el attempt devuelve la pauta completa solo post-envío en `reviewData`), `badges.py` (5 reglas), `streak.py` (3 branches). Los intentos sobre lecciones en borrador (docente) se rechazan con 404 |
| `telemetry/` | `AccessLog` (middleware), `StudySession` (heartbeat, valida que la sesión pertenezca al usuario), `EventLog` (con rate limiting, scope `telemetry_events`), alarma de uso diario, **`AuditLog`** (auditoría de seguridad: logins exitosos/fallidos, cambios/reset de contraseña, creación de cuentas, moderación de reportes y cambios de configuración crítica del curso — registrar vía `telemetry/audit.py::log_security_event`) y `manage.py purge_telemetry` (retención configurable: `TELEMETRY_RETENTION_DAYS`/`AUDIT_LOG_RETENTION_DAYS`, default 365 días) |
| `analytics/` | Panel docente y progreso del estudiante (`aggregations.py`) |
| `tutor/` | Capa de abstracción de IA en `tutor/ai/` (`base.py`, `factory.py`, `openai_provider.py`, `gemini_provider.py`, `prompts.py`) + `services.py` con `generate_activity_feedback` (retroalimentación de actividades). El chat socrático (modelo ChatMessage y endpoint `/api/tutor`) fue eliminado del producto |
| `sandbox/` | Course Builder del docente — CRUD admin del currículo live (`/api/admin/units|lessons|activities|objectives|rubrics`, solo docentes), configuración del diagnóstico general (`GET/PATCH /api/admin/course/diagnostic`) y de la prueba de cierre (`GET/PUT /api/admin/course/final-exam`), y `POST /api/uploads` (subida de imágenes para el editor, máx. 5 MB a `MEDIA_ROOT/uploads/`). Sin modelos propios: el flujo sandbox de cursos (Course/QuestionBank/DataResource y `publish_to_curriculum`) fue eliminado del producto |
| `reports/` | Reportes de error (contenido del curso, actividades y `platform` — el botón flotante global). POST abierto a cualquier autenticado; GET/PATCH (moderación) solo docentes vía `accounts.permissions.IsTeacher`. El GET expone `reporterCode` (código) para estudiantes, nunca email/nombre |
| `search/` | Búsqueda global |
| `fixtures/` | Datos seed (badges, etc.); `learning/management/commands/seed_demo.py` genera los datos demo |

Todas las rutas de API cuelgan de `/api/` (ver `config/urls.py`), por parity con
el frontend que ya llama a `/api/...` cambiando solo el host base.

### Frontend (`src/`)

- `src/app/` — App Router con una **única página** (`page.tsx`); la app funciona
  como SPA cliente: `view-router.tsx` + el store deciden qué vista renderizar.
  `page.tsx` también aplica los **gates post-login** en orden: cambio de
  contraseña obligatorio (`force-change-password-view`) y, solo estudiantes,
  **consentimiento informado electrónico** (`consent-view`, gate único
  centrado que registra la decisión vía `POST /api/course/consent` — 6
  pantallas con el texto COMPLETO de cada sección del formulario; TODAS
  exigen esperar 10 s y las 5 primeras además exigen marcar "He leído y
  comprendido esta información" parte por parte; la 6ª resume las secciones
  leídas y muestra la decisión — Opción 1 autorizo con las 6 casillas
  checklist del formulario / Opción 2 no autorizo — con "Registrar mi
  decisión" inactivo por defecto; el PDF del formulario NO se distribuye
  desde la plataforma) y diagnóstico general del curso
  (`course-diagnostic-view`, consulta `GET /api/course/status`).
- `src/components/views/` — vistas principales (login, dashboard, units,
  unit-detail, lesson, activity, final-exam, teacher, progress, achievements,
  bookmarks, course-builder, about).
- `src/components/app/` — shell de la aplicación (header, sidebar, footer,
  búsqueda global, notificaciones). El sidebar colapsa a un **mini-rail de
  iconos** en desktop (nunca desaparece) y es drawer con overlay en móvil.
  Incluye `global-report-fab.tsx`: botón flotante de reporte (`fixed bottom-6
  right-6 z-40`) montado en `app-shell.tsx` y visible en **todas** las vistas
  autenticadas; envía `source: "platform"` con `sourceId` contextual
  (`page:<view>;unit:<id>;...`). El diálogo es `report-error-dialog.tsx`
  (reutilizable en modo controlado o con trigger propio; también lo usan
  unit-detail y lesson-view con `source: "content"`). El menú de usuario del
  header ofrece a estudiantes con autorización vigente la opción **"Revocar mi
  autorización para el uso científico de datos"** (`revoke-consent-dialog.tsx`,
  checklist de 4 casillas + `POST /api/course/consent/revoke`, visible hasta
  `CONSENT_REVOKE_DEADLINE`); la vista `about` tiene además la sección "Mi
  consentimiento" con el estado actual del consentimiento del estudiante.
  `cookie-notice.tsx` es el **aviso de cookies** (Ley 21.719): se monta en
  `layout.tsx` (visible también en el login, donde ya se instalan las
  cookies de sesión/CSRF), es solo informativo —todas las cookies son
  esenciales, sin opción de rechazo— y su aceptación persiste por equipo en
  `localStorage` (`electromed_cookie_notice`, sobrevive al logout).
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
  unidades/lecciones — **Reader 2.0**: `splitContentSections` por H2,
  `CHECKPOINT_SEPARATOR` + `splitCheckpoints`/`parseCheckpointQuestions`,
  anclas `slugifyHeading`, `getProseClasses(size)` (tamaño de lectura),
  `estimateReadingMinutes` y el componente `<CourseMarkdown>`, que enchufa
  los plugins (`remark-gfm` tablas, `remark-math` + `rehype-katex` fórmulas
  `$...$`/`$$...$$`, `rehype-highlight` sintaxis con tema hljs propio en
  `globals.css`) y los overrides de render: bloques de código con header de
  lenguaje + botón copiar (`app/code-block.tsx`), callouts tipados
  `> [!nota|advertencia|seguridad|dato|ejemplo]` (`app/callout.tsx`),
  imágenes con zoom y caption (`app/content-image.tsx`), tablas con scroll
  y fences interactivos — ` ```repaso ` → auto-repaso P:/R:
  (`app/quick-check.tsx`), ` ```glosario ` → términos `Término :: definición`
  (`app/glossary-block.tsx`)). Lo usan `lesson-view` y `unit-detail-view`;
  `lesson-toc` re-exporta el slug. La experiencia de lectura es paritaria en
  ambas vistas: TOC con scroll-spy, `ReadingProgress`, `ReadingControls`
  (A−/A+, persiste `electromed_reader_font` vía `useSyncExternalStore` en
  `app/reading-controls.tsx`) y anclas copiables en headings H2/H3.
  Las tarjetas de unidad (dashboard y listado) son el componente compartido
  `src/components/views/unit-card.tsx`, con progreso real (completed/total y
  mastery de `GET /api/units`).
- **Seguridad cliente**: `next.config.ts` emite cabeceras de seguridad (CSP,
  `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`) con
  el origen del API leído de `NEXT_PUBLIC_API_URL`. El logout (`page.tsx`)
  borra TODO el almacenamiento local de la sesión (flag, store persistido,
  borradores, historial de búsqueda) por privacidad en equipos compartidos;
  solo se conserva la preferencia de tamaño de letra. Las actividades reciben
  la pauta sanitizada en el GET de lección y la completa solo tras enviar
  (`reviewData` del attempt). El leaderboard anonimiza a los demás
  estudiantes (sin email ni códigos ajenos). La búsqueda global no expone
  borradores a estudiantes.
- **Editor de contenido docente**: `src/components/ui/markdown-editor.tsx` —
  WYSIWYG basado en **TipTap v2** (`@tiptap/react` + `starter-kit` + `image` +
  `link` + `placeholder` + `table`/`-table-row`/`-table-header`/`-table-cell` +
  `tiptap-markdown`). El contrato sigue siendo
  Markdown (`value`/`onChange`): `tiptap-markdown` convierte en ambos sentidos.
  Dentro del editor las imágenes `/media/...` se resuelven contra `API_BASE`
  (helpers `toEditor`/`fromEditor`); en el Markdown persistido quedan
  relativas. Toolbar con formato, listas, citas, código, enlaces, subida de
  imágenes (botón, Ctrl+V o arrastrar), videos YouTube/Vimeo (se embeben al
  publicar), **tablas** (botón + mini-menú de filas/columnas; se serializan a
  GFM con serializers propios de `tiptap-markdown` vía
  `addStorage().markdown.serialize`, escape `\|` y bloques/saltos de línea
  intra-celda degradados a espacio — GFM no admite saltos en celdas y la
  plataforma renderiza con HTML deshabilitado),
  **callouts** (menú "Aviso": inserta un blockquote `[!tipo]` en texto plano,
  round-trip seguro), menú "Sintaxis avanzada" en el pie (copia ejemplos de
  fórmulas KaTeX, tabla GFM, callout y bloques repaso/glosario),
  deshacer/rehacer, modo "Markdown" en crudo, pantalla completa y
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
  password, captchaKey, captchaValue}`: código de estudiante (`EM-0001`) o
  email docente, más el captcha (ver `accounts/`). Como la cookie
  es HttpOnly, el frontend guarda un flag `electromed-session` en `localStorage`
  para saber si debe revalidar con `/api/me`. Tras autenticar, `page.tsx`
  aplica los gates de `mustChangePassword`, del consentimiento informado y
  del diagnóstico general antes de montar el `AppShell`.
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
pytest                        # todos los tests (~208)
pytest learning/tests/        # grading / badges / streak / attempt / consent / seguridad
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
  es solo para desarrollo y **prod.py aborta el arranque si se usa en
  producción** (`ImproperlyConfigured`).
- **Autenticación**: sesiones Django por cookie HttpOnly (`SessionAuthentication`),
  `SESSION_COOKIE_AGE` de 7 días; en producción activar `SESSION_COOKIE_SECURE`
  y `CSRF_COOKIE_SECURE` (default seguro en prod.py) y, con TLS operativo,
  `SECURE_SSL_REDIRECT=1` + `SECURE_HSTS_SECONDS=31536000`. El login usa un
  identificador único: email para docentes (`@uv.cl`), `student_code` para
  estudiantes — **los estudiantes son anónimos dentro de la plataforma** (sin
  email ni nombre real; la tabla que mapea código ↔ identidad se mantiene fuera
  del sistema). No existe registro público: solo el docente crea cuentas
  (`/api/admin/students`, con códigos elegidos por él o aleatorios generados
  por la plataforma) y resetea contraseñas; toda contraseña temporal fuerza
  cambio obligatorio (`must_change_password`). El login y la telemetría tienen
  **rate limiting** (DRF throttling, scopes `login`/`telemetry_events`).
  Las contraseñas se almacenan **hasheadas con Argon2id** (`PASSWORD_HASHERS`
  en `base.py`, paquete `argon2-cffi`; recomendación OWASP). Los hashers
  PBKDF2 quedan como fallback solo para verificar hashes antiguos, que Django
  migra a Argon2 en el próximo login exitoso del usuario.
- **Auditoría de seguridad**: los eventos sensibles (logins exitosos y fallidos,
  cambios/reset de contraseña, creación de cuentas, moderación de reportes,
  cambios de configuración crítica, registro y retiro del consentimiento
  informado — `consent_registered`/`consent_revoked`) se registran en
  `telemetry.AuditLog` vía
  `log_security_event` — cualquier vista nueva con acciones sensibles debe
  usarlo. La retención se aplica con `manage.py purge_telemetry`.
- **Consentimiento informado (investigación)**: la decisión del estudiante
  sobre el uso científico de sus datos es **invisible para el profesor**
  (ficha de datos §6-§7): ningún endpoint docente la expone y el
  `research_code` (segundo código) nunca sale al frontend. El canal del
  coinvestigador es el admin de Django (`StudentConsent`, solo lectura) y
  `manage.py export_research_data`; **el docente de la asignatura no debe
  tener cuenta staff del admin en producción** (el listado revela la
  decisión y la correspondencia de códigos). La versión del documento se
  fija con `CONSENT_VERSION` y el plazo de retiro con
  `CONSENT_REVOKE_DEADLINE` (ver `.env.example`).
- **CORS/CSRF**: orígenes permitidos en `CORS_ALLOWED_ORIGINS` y
  `CSRF_TRUSTED_ORIGINS` (default: localhost:3000); `CORS_ALLOW_CREDENTIALS=True`
  es necesario para las cookies cross-origin. Restringir en producción.
- **DRF**: por defecto todos los endpoints exigen `IsAuthenticated`
  (ver `REST_FRAMEWORK` en `base.py`). No relajar este default sin razón.
  Además, la gestión de contenido (todo `sandbox/` — Course Builder y CRUD
  `/api/admin/*`), la gestión de estudiantes (`/api/admin/students*`),
  la configuración de evaluaciones (`/api/admin/course/*`), la moderación de
  reportes y la analítica docente (`/api/teacher`, `/api/teacher/student/<id>`)
  exigen el permiso `accounts.permissions.IsTeacher` (rol docente).
  La analítica y los reportes identifican estudiantes solo por `studentCode`.
- **IA**: las API keys nunca se exponen al frontend; si falta la key, los
  servicios usan fallbacks en español en vez de fallar. El provider `openai`
  acepta `OPENAI_BASE_URL` para APIs OpenAI-compatibles (p. ej. Kimi/Moonshot
  con `https://api.kimi.com/coding/v1` y `AI_MODEL=kimi-for-coding`).
- La telemetría registra datos de uso por usuario autenticado; tenerlo en
  cuenta al manipular `AccessLog`/`StudySession`/`EventLog`.

## Despliegue

- **Guía completa**: `DEPLOY.md` (variables obligatorias, cookies según
  HTTPS/HTTP, verificación, respaldos con `backend/scripts/backup.sh`,
  purga de telemetría, **costos estimados de VPS**).
- **CI**: `.github/workflows/ci.yml` corre tests de backend, lint de frontend
  y auditoría de dependencias (pip-audit + npm audit) en cada push/PR.
- **Producción**: `docker compose up --build` — Postgres 16 (puerto publicado
  solo en `127.0.0.1`) + gunicorn (3 workers, `config.wsgi:application`) +
  Next.js standalone (`Dockerfile.frontend` multi-etapa: deps → build →
  runtime con `node server.js`; la imagen final no incluye `node_modules`
  completo). Todos los contenedores corren con **usuario no-root**
  (`appuser`/`node`).
- **Estáticos y media en prod**: WhiteNoise sirve `/static/` desde gunicorn
  (middleware + `CompressedManifestStaticFilesStorage` en
  `config/settings/prod.py`); `/media/` lo sirve Django vía
  `django.views.static.serve` en `config/urls.py`. Las subidas de docentes
  persisten en el volumen `media_data`.
- **HTTPS/TLS**: el override `docker-compose.tls.yml` + `Caddyfile` (raíz)
  agregan **Caddy** como reverse proxy con certificado Let's Encrypt
  automático (`DOMAIN` en `.env`); enruta `/api/`, `/admin/` y `/media/` al
  backend y el resto al frontend bajo el mismo origen, y restringe los
  puertos 3000/8000 a `127.0.0.1`. Arranque: `docker compose -f
  docker-compose.yml -f docker-compose.tls.yml up --build -d` (DEPLOY.md §9).
  Cuando `SECURE_SSL_REDIRECT=1`, `prod.py` exime `/api/health` del redirect
  para no romper el healthcheck interno de Docker.
- **Cookies en prod**: `prod.py` las toma del entorno con default seguro
  (`SECURE=1`, `SAMESITE=None`). En despliegues HTTP sin TLS hay que definir
  `SESSION_COOKIE_SECURE=0`/`CSRF_COOKIE_SECURE=0`/`SAMESITE=Lax` o el login
  no persiste (ver `DEPLOY.md`).
- **Contextos de build**: `.dockerignore` (raíz) y `backend/.dockerignore`
  excluyen `.env`, `.git`, `node_modules`, `.next`, `.venv`, `media/` y
  `staticfiles/` — no los elimines del ignore (riesgo de secretos en imagen).
- **Desarrollo con hot-reload**: override `docker-compose.dev.yml`
  (runserver + `next dev`, monta el código como volumen).
