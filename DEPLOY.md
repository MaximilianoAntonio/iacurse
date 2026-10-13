# Despliegue en producción — Plataforma Electromedicina II

Guía mínima para levantar el stack completo (PostgreSQL + Django + Next.js)
con Docker Compose en un servidor.

## 1. Requisitos

- Docker Engine 24+ con el plugin Compose v2.
- Puertos libres: `3000` (frontend), `8000` (backend), `5432` (Postgres,
  solo si se expone fuera de la red Docker).

## 2. Configurar el entorno

```bash
cp .env.example .env
```

Editar `.env` y ajustar **obligatoriamente**:

| Variable | Valor recomendado |
|---|---|
| `DJANGO_MODE` | `prod` |
| `DJANGO_DEBUG` | `0` |
| `DJANGO_SECRET_KEY` | **Obligatoria en prod** (el backend no arranca con la clave de desarrollo): `python -c "import secrets; print(secrets.token_urlsafe(50))"` |
| `POSTGRES_PASSWORD` | password fuerte (no el default `electromed`) |
| `DJANGO_ALLOWED_HOSTS` | dominio/IP del servidor, p. ej. `midominio.uv.cl,backend` |
| `CORS_ALLOWED_ORIGINS` | URL pública del frontend, p. ej. `https://midominio.uv.cl` |
| `CSRF_TRUSTED_ORIGINS` | igual que `CORS_ALLOWED_ORIGINS` |
| `NEXT_PUBLIC_API_URL` | URL pública del backend tal como la ve el navegador |
| `EMAIL_HOST` / `EMAIL_PORT` / `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` | SMTP institucional para el código MFA docente (**obligatorio**: `prod.py` aborta si el MFA está activo sin SMTP real) |
| `OPENAI_API_KEY` / `GEMINI_API_KEY` | **IA desactivada por defecto** (`AI_PROVIDER=fallback`, hallazgo 2.3: sin envío de datos a terceros hasta regularizarlo con DTIC/DPO). Solo si se reactiva: `AI_PROVIDER=openai`/`gemini` + su key |

### Cookies según el esquema (HTTPS vs HTTP)

- **Con HTTPS** (reverse proxy con TLS delante, §9): dejar los defaults
  (`SESSION_COOKIE_SECURE=1`, `SAMESITE=Lax`). No hace falta definirlas.
  Con Caddy frontend y API van bajo el mismo origen, así que `Lax` es
  suficiente y más seguro (hallazgo 2.9). Usar `SAMESITE=None` solo si el
  frontend y la API se sirven desde orígenes distintos.
- **HTTP plano** (piloto en red interna sin TLS): los navegadores rechazan
  cookies `Secure`. Definir en `.env`:

  ```env
  SESSION_COOKIE_SECURE=0
  CSRF_COOKIE_SECURE=0
  SESSION_COOKIE_SAMESITE=Lax
  CSRF_COOKIE_SAMESITE=Lax
  ```

Sin este ajuste el login no persiste (el navegador descarta la cookie).

La sesión expira **por inactividad** (`SESSION_COOKIE_AGE_DAYS`, default 7
días desde la última actividad; la cookie se renueva con cada request
autenticado).

### MFA docente (segundo factor por email)

En producción las cuentas **docentes** exigen un código de un solo uso
enviado a su email institucional tras la contraseña (hallazgo 2.9; los
estudiantes, seudonimizados y sin email real, quedan exentos). Variables:

| Variable | Descripción |
|---|---|
| `TEACHER_MFA_ENABLED` | `1` por defecto en prod; `0` lo desactiva explícitamente (documentar la justificación en el expediente). En dev/test el default es `0`. |
| `EMAIL_BACKEND` | `django.core.mail.backends.smtp.EmailBackend` en producción (default: `console` en dev, el código sale en los logs del backend). |
| `EMAIL_HOST` / `EMAIL_PORT` | Servidor SMTP institucional (p. ej. `smtp.uv.cl` / `587`). |
| `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` | Credenciales SMTP si el servidor las exige. |
| `DEFAULT_FROM_EMAIL` | Remitente del código (default `no-reply@uv.cl`). |
| `MFA_CODE_TTL_MINUTES` / `MFA_MAX_ATTEMPTS` | Vigencia del código (default 10 min) e intentos máximos (default 5). |

### Consentimiento informado (investigación)

La plataforma registra el consentimiento electrónico de los estudiantes para
el uso científico de sus datos (ficha de datos del estudio). Variables
opcionales en `.env` (tienen default):

| Variable | Descripción |
|---|---|
| `CONSENT_VERSION` | Versión del documento de consentimiento que se registra como evidencia (default `2026-08-V2`). Debe calzar con el PDF servido en `public/consentimiento-informado.pdf`: si el documento cambia, actualizar ambos. |
| `CONSENT_REVOKE_DEADLINE` | Fecha ISO límite para que un estudiante retire su autorización (default `2026-12-11`, sugerido: cierre de notas del semestre). Pasada esa fecha el retiro se rechaza. |

**Importante (ficha §6-§7)**: el profesor de la asignatura no debe conocer
las decisiones individuales. No crear cuentas *staff* del admin de Django
para el docente en producción: el listado `StudentConsent` del admin revela
la decisión y la correspondencia de códigos. La cuenta staff es solo para el
**coinvestigador**.

## 3. Build y arranque

```bash
docker compose up --build -d
docker compose ps        # los 3 servicios deben quedar healthy/running
docker compose logs -f backend
```

El entrypoint del backend espera a Postgres, corre `migrate`, `collectstatic`
y, **solo en modo dev/debug (o con `LOAD_DEMO_DATA=1`)**, si la base está
vacía carga fixtures + `seed_demo`. En producción el seed está bloqueado
(las cuentas demo tienen contraseñas públicas del repo). Para crear la
primera cuenta docente en producción:

```bash
docker compose exec backend python manage.py shell -c "
from accounts.models import User
u = User(email='docente@uv.cl', username='docente@uv.cl', name='Docente', role='teacher', is_staff=True)
u.set_password('<password-inicial-fuerte>')
u.save()"
```

Luego, desde el panel docente, crear las cuentas de estudiantes (cada una
con contraseña temporal de un solo uso y cambio obligatorio).

## 4. Verificación

- `curl http://localhost:8000/api/health` → `{"status": "ok", ...}`
- Frontend: `http://<servidor>:3000`
- Admin Django: `http://<servidor>:8000/admin` (con CSS — servido por WhiteNoise)
- Login con la cuenta docente creada y navegación básica.
- Postgres **no** debe ser visible desde fuera: `docker compose port db 5432`
  debe mostrar solo `127.0.0.1` como publicación.

## 5. Datos persistentes

Dos volúmenes nombrados; respaldarlos para no perder información:

- `postgres_data` — base de datos completa.
- `media_data` — imágenes subidas por docentes desde el Course Builder.

Respaldo automatizado **cifrado** (script incluido en el repo, con retención
de 30 días; hallazgo 2.14 — el script aborta sin cifrado configurado):

```bash
# Elegir UNA vía de cifrado en el entorno (p. ej. en .env o el crontab):
#   BACKUP_GPG_RECIPIENT=seguridad@uv.cl   (clave pública del responsable; recomendado)
#   BACKUP_PASSPHRASE=<frase fuerte>       (AES-256 con OpenSSL)
# Desde la raíz del proyecto en el servidor:
sh backend/scripts/backup.sh
# Cron diario sugerido (03:23) — los respaldos son además el archivo en frío
# de los logs de auditoría/telemetría (política de retención 12m + 24m):
#   23 3 * * *  cd /ruta/iacurse && sh backend/scripts/backup.sh >> /var/log/electromed-backup.log 2>&1
```

**Copia fuera del servidor (obligatoria)**: un respaldo en el mismo disco no
es respaldo. Copiar `backups/` periódicamente a almacenamiento institucional
(rsync/OneDrive/object storage). **Prueba de restauración mensual**: el
procedimiento está documentado en el encabezado de `backend/scripts/backup.sh`
(restorar en una base desechable `restore_test`, verificar conteos y
eliminarla).

Purga periódica de registros según la política de retención (12 meses en
caliente; `TELEMETRY_RETENTION_DAYS` / `AUDIT_LOG_RETENTION_DAYS`):

```bash
docker compose exec backend python manage.py purge_telemetry
# Programar p. ej. semanal:  41 4 * * 0  cd /ruta/iacurse && docker compose exec -T backend python manage.py purge_telemetry
```

Exportación de los datos de investigación (a cargo del **coinvestigador**,
ficha de datos §3). Genera CSV en `backend/research_export/<timestamp>/`
(dentro del contenedor; copiarlos con `docker compose cp` o ejecutar con
`--out` sobre un volumen):

```bash
# Registro del consentimiento (§3.2): primer código, decisión, fecha/hora, versión, estado
docker compose exec backend python manage.py export_research_data --kind consent
# Tabla de correspondencia primer ↔ segundo código (§3.3)
docker compose exec backend python manage.py export_research_data --kind mapping
# Base científica (§3.4): solo autorizaciones vigentes, solo segundo código
docker compose exec backend python manage.py export_research_data --kind scientific
```

La custodia de estos CSV es en la cuenta institucional de Microsoft 365 del
coinvestigador, y las tablas con primer código se eliminan una vez subidas
las notas al registro académico (ficha §8-§9: proceso manual, fuera de la
plataforma).

## 6. Notas operativas

- Los estáticos del admin/DRF los sirve WhiteNoise desde gunicorn; `/media/`
  lo sirve Django. Suficiente para la escala del piloto. HTTPS/TLS con
  dominio: ver §9 (Caddy con Let's Encrypt automático).
- `NEXT_PUBLIC_API_URL` se incrusta en el bundle en **build-time**:
  cambiarla requiere `docker compose up --build` (no basta reiniciar).
- Actualizar el código: `git pull && docker compose up --build -d`
  (las migraciones corren solas en el arranque del backend).

## 7. Dónde desplegar y costos estimados (agosto 2026)

Dimensionamiento para el piloto (~25–60 estudiantes concurrentes como máximo,
stack Docker: Postgres + gunicorn + Next.js standalone): **mínimo 2 vCPU /
4 GB RAM / 40 GB SSD**; recomendado 2 vCPU / 4 GB con margen de disco o
4 vCPU / 8 GB si crece el curso. La IA es externa (OpenAI/Gemini), no suma
carga local relevante.

> **Nota**: la opción de Oracle Cloud "Always Free" quedó **descartada**
> (la tier fue recortada/restringida en 2026 y ya no está disponible para
> nuevas cuentas en la práctica). No considerarla en la decisión.

### Opción 0 — Institucional (definir en la reunión)

Al ser un Piloto de Innovación Docente de la UV, la primera pregunta de la
reunión debería ser si la universidad ofrece hosting interno o un subdominio
`*.uv.cl`: costo $0, datos dentro de la institución y sin contratos externos.
Si existe la opción, es la mejor para un piloto académico. El resto de esta
guía asume que no.

### Opción 1 — VPS económico (US$5–9/mes) — la opción pagada recomendada

| Proveedor | Plan | Specs | Precio/mes* | Notas |
|---|---|---|---|---|
| Hetzner | CX23 | 2 vCPU / 4 GB / 40 GB | ~€5,50 (~US$6) + IVA | Reemplaza al deprecado CX22 (serie renombrada y con alzas en 2026); DC en EU y EE.UU. Backups +20%; ojo: la IPv4 pública puede cobrarse aparte (~€0,50) |
| **OVHcloud** (recomendado) | VPS-1 | 4 vCPU / 8 GB / 75 GB NVMe | ~US$6,50 | Más recursos por el mismo precio; **backups diarios y anti-DDoS incluidos** |
| Hetzner | CX33 | 4 vCPU / 8 GB / 80 GB | ~€8,50 (~US$9) + IVA | Reemplaza al CX32; margen para crecer |
| Contabo | Cloud VPS | 4 vCPU / 8 GB / 75 GB | ~US$7 | Barato por GB, pero overcommit agresivo (rendimiento variable) |
| Hostinger | KVM 2 | 2 vCPU / 8 GB / 100 GB NVMe | ~US$8 intro / **US$15 renovación** | El precio promocional sube ~80% al renovar |

\* Precios de lista sin impuestos; varían por región y pago anual.

Con las alzas de Hetzner de 2026, **OVHcloud VPS-1 quedó como la opción con
mejor equilibrio** para este piloto: 4 vCPU / 8 GB con backups incluidos por
~US$6,50/mes (**~US$78/año**). Hetzner CX23 es equivalente en precio pero con
la mitad de RAM y backups pagados aparte.

### Opción 2 — Latencia mínima paga: São Paulo (US$12–24/mes)

Desde Chile, Hetzner/OVH (Europa o EE.UU.) dan ~150–220 ms; para una
plataforma de estudio es tolerable, pero si se quiere respuesta rápida:

| Proveedor | Plan | Precio/mes | Región |
|---|---|---|---|
| AWS Lightsail | 2 vCPU / 2 GB / 60 GB, 3 TB transfer | ~US$12 | São Paulo |
| Vultr | 2 vCPU / 4 GB / 80 GB | ~US$20 | São Paulo |
| DigitalOcean | Basic 2 vCPU / 4 GB | ~US$24 | São Paulo |

### Descartadas

- **PaaS (Railway / Render / Fly.io)**: US$7–25/mes por servicio y la base de
  datos Postgres se cobra aparte; para un stack con Postgres persistente sale
  2–4 veces más caro que un VPS y no aporta nada que el Docker Compose ya no haga.
- **AWS/GCP/Azure directo en Santiago** (Azure Chile Central, GCP
  southamerica-west1): regiones locales pero VMs desde ~US$30/mes — sobreprecio
  para la escala del piloto.

### Recomendación final

1. Preguntar por **hosting institucional UV** (costo $0, datos en casa).
2. Si no: **OVHcloud VPS-1** (~US$6,50/mes con backups incluidos, **~US$78/año**)
   — el mejor equilibrio precio/recursos tras las alzas de 2026. Hetzner CX23
   (~€5,50 + IVA + backups +20%) como alternativa equivalente.
3. Si la latencia desde Chile es un requisito explícito: **AWS Lightsail São
   Paulo** (~US$12/mes) o Vultr São Paulo (~US$20/mes).

Costos adicionales a presupuestar:

- **Dominio**: ~US$10–15/año (o subdominio institucional `*.uv.cl` gratis).
- **TLS**: gratis con el override Caddy incluido (§9) o Cloudflare (plan gratis).
- **Backups**: incluidos en OVH VPS; +20% del plan en Hetzner/DO; o respaldos
  manuales con `pg_dump` (sección 5) sin costo.
- **API de IA** (OpenAI/Gemini): según uso; sin key la plataforma funciona con
  fallbacks, pero la personalización y la retroalimentación por IA la justifican.

Total estimado del piloto: **US$0–15 el primer año** (institucional + dominio)
o **~US$90–100** (OVH VPS-1 o Hetzner CX23 + dominio).

## 8. Despliegue paso a paso en un VPS (genérico, vale para cualquier proveedor)

Esta guía aplica igual a Hetzner, OVHcloud, Vultr, Lightsail o cualquier VPS
con Ubuntu 24.04 x86_64 y acceso root por SSH. El build de Next.js en la VM
demora ~5 min en x86 (si alguna vez se usa una VM ARM, ~10–20 min, pero las
imágenes son multi-arch y funciona igual).

### 8.1 Crear la VM

1. Crear una VM/VPS con **Ubuntu 24.04 LTS**, mínimo 2 vCPU / 4 GB RAM /
   40 GB SSD (OVH VPS-1, Hetzner CX23, Vultr vc2-2c-4gb, etc.).
2. Asignar IP pública y configurar acceso **SSH por clave** (subir la clave
   pública al crearla; guardar la privada).
3. Si el proveedor tiene firewall en consola (Hetzner Cloud Firewall,
   Security Groups de Lightsail, etc.), abrir TCP `80` y `443` (HTTPS con
   Caddy, §9). Los puertos `3000` y `8000` solo hacen falta si se despliega
   por HTTP plano sin proxy.

### 8.2 Firewall de la VM (ufw)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp     # HTTP: redirect a HTTPS + desafío ACME de Let's Encrypt
sudo ufw allow 443/tcp    # HTTPS (Caddy)
sudo ufw enable
```

> Los puertos `3000` y `8000` solo se abren en despliegues **HTTP planos**
> (red interna, §8.3). Con Caddy (§9) no deben ser accesibles desde Internet:
> el override TLS los restringe a `127.0.0.1`.

### 8.3 Instalar Docker y desplegar

```bash
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2
sudo usermod -aG docker ubuntu && newgrp docker

git clone <URL-del-repo> iacurse && cd iacurse
cp .env.example .env
```

Editar `.env` con los valores de producción (IP pública de la VM como `<IP>`):

```env
DJANGO_MODE=prod
DJANGO_DEBUG=0
DJANGO_SECRET_KEY=<generar: python3 -c "import secrets; print(secrets.token_urlsafe(50))">
POSTGRES_PASSWORD=<password fuerte>
DJANGO_ALLOWED_HOSTS=<IP>,localhost,127.0.0.1,backend
CORS_ALLOWED_ORIGINS=http://<IP>:3000
CSRF_TRUSTED_ORIGINS=http://<IP>:3000
NEXT_PUBLIC_API_URL=http://<IP>:8000
# HTTP plano (sin dominio/TLS): obligatorio o el login no persiste
SESSION_COOKIE_SECURE=0
CSRF_COOKIE_SECURE=0
SESSION_COOKIE_SAMESITE=Lax
CSRF_COOKIE_SAMESITE=Lax
# MFA docente: en prod exige SMTP real; en una prueba interna sin SMTP se
# puede desactivar explícitamente (documentar la justificación):
#TEACHER_MFA_ENABLED=0
# IA desactivada por defecto (hallazgo 2.3); reactivar solo tras regularizar:
#AI_PROVIDER=openai
#OPENAI_API_KEY=...
```

```bash
docker compose up --build -d     # ~5 min la primera vez
docker compose ps                # los 3 servicios healthy
curl http://localhost:8000/api/health
```

App: `http://<IP>:3000`. Este esquema por IP y HTTP plano es solo para
pruebas en red interna: expone credenciales y cookies de sesión en tránsito,
y para información clasificada como Confidencial (datos personales y
registros académicos) la política institucional exige TLS 1.2+. El
despliegue definitivo debe ir con dominio y HTTPS — ver **§9** (Caddy con
certificado Let's Encrypt automático).

### 8.4 Respaldos

```bash
# Script del repo (retención 30 días, configurable con BACKUP_RETENTION_DAYS).
# Cifrado OBLIGATORIO (hallazgo 2.14): definir BACKUP_GPG_RECIPIENT o
# BACKUP_PASSPHRASE o el script aborta.
sh backend/scripts/backup.sh
# cron diario en la VM; copiar los .sql.gz.gpg/.enc periódicamente a otro lado (scp/drive)
```

Alternativa complementaria: activar los backups automáticos del proveedor
(Hetzner/DO: +20% del plan; OVH: incluidos). Para restaurar (descifrando
antes — ver el encabezado de `backend/scripts/backup.sh`):

```bash
gpg -d backups/electromed_YYYYMMDD_HHMMSS.sql.gz.gpg | gunzip | docker compose exec -T db psql -U electromed -d electromed
```

Hacer una **prueba de restauración mensual** en una base desechable
(procedimiento completo en el encabezado del script).

### 8.5 Control de costos

- El VPS es cobro fijo mensual — sin sorpresas mientras no se creen recursos
  extra (IPs reservadas sueltas, volúmenes adicionales o snapshots pagados
  son lo único que suele sumar).
- Activar la alerta de consumo/presupuesto del proveedor si la ofrece.
- Revisar la factura el primer mes para confirmar que coincide con el plan.

### 8.6 Capacidad estimada

25 estudiantes concurrentes es carga mínima para este stack: gunicorn con
3 workers en 2 vCPU, Postgres con un dataset de MBs, Next.js standalone. La
VM usa ~1,5–2 GB de los 4 GB disponibles. En la práctica aguanta varias
veces esa concurrencia; el único cuello real es la latencia de las llamadas
externas a la IA (OpenAI/Gemini), que no pasa por la VM.

## 9. HTTPS / TLS con Caddy (certificado automático)

El repo incluye un override `docker-compose.tls.yml` + `Caddyfile` que ponen
**Caddy** delante del stack: termina TLS con certificado **Let's Encrypt**
(emisión y renovación automáticas), redirige HTTP→HTTPS y enruta por path —
`/api/`, `/admin/` y `/media/` van al backend Django y el resto al frontend
Next.js, todo bajo el mismo dominio (mismo origen: se acaba el CORS).

### 9.1 Requisitos

1. Un **dominio** (o subdominio `*.uv.cl`) con registro DNS `A` apuntando a
   la IP pública del servidor.
2. Puertos `80` y `443` abiertos (ufw §8.2 y firewall del proveedor). El 80
   es obligatorio: Caddy lo usa para el desafío ACME y para redirigir a HTTPS.
3. **Docker Compose ≥ 2.24** (el override usa la etiqueta YAML `!override`);
   cualquier Docker Engine 25+ la incluye.

### 9.2 Configuración de `.env`

```env
DOMAIN=electromed.uv.cl
# El navegador solo habla con Caddy: la API queda en el MISMO origen.
NEXT_PUBLIC_API_URL=https://electromed.uv.cl
DJANGO_ALLOWED_HOSTS=electromed.uv.cl,backend
CORS_ALLOWED_ORIGINS=https://electromed.uv.cl
CSRF_TRUSTED_ORIGINS=https://electromed.uv.cl
# Cookies seguras (son los defaults de prod.py; quitar los overrides =0/Lax
# si venías de un despliegue HTTP plano) y endurecer transporte:
SECURE_SSL_REDIRECT=1
SECURE_HSTS_SECONDS=31536000
```

### 9.3 Arranque y verificación

```bash
docker compose -f docker-compose.yml -f docker-compose.tls.yml up --build -d
docker compose ps                 # db, backend, frontend y caddy healthy
docker compose logs -f caddy      # primera emisión del certificado (~30 s)
curl -I https://electromed.uv.cl/api/health
```

Notas:

- Con este override los puertos `3000`/`8000` quedan publicados solo en
  `127.0.0.1` (depuración); todo el tráfico público entra por Caddy.
- Los certificados viven en el volumen `caddy_data` — **no borrarlo**:
  Let's Encrypt aplica rate limits si se reemite desde cero.
- `NEXT_PUBLIC_API_URL` se incrusta en build-time: tras cambiarla hay que
  rebuildar (`up --build`), no basta reiniciar.
- El healthcheck interno del backend sigue siendo HTTP plano dentro de la
  red Docker; por eso `prod.py` exime `/api/health` de `SECURE_SSL_REDIRECT`.
- Para probar TLS en local sin dominio: `DOMAIN=localhost` — Caddy usa su CA
  interna (el navegador pedirá confiar en el certificado autofirmado).

## 10. Roadmap de seguridad acordado

Compromisos registrados ante el Departamento de Ciberseguridad (informe de
oct-2026), sin cambios de código por ahora:

- **Autenticación institucional (hallazgo 2.23)**: integrar el login con la
  autenticación institucional de la UV **antes de ampliar el piloto** a más
  cursos o cohortes. Mientras tanto, los parámetros de contraseña actuales
  (Argon2id, mínimo 8 caracteres, validadores de fortaleza, cambio obligatorio
  de temporales, captcha + rate limit + MFA docente) deben validarse
  formalmente con DTIC y el Departamento de Ciberseguridad.
- **IA (hallazgo 2.3)**: la reactivación del `AI_PROVIDER` externo exige la
  certificación de la conexión por DTIC/Ciberseguridad y el pronunciamiento
  del DPO; ver la tabla de variables en §2.
