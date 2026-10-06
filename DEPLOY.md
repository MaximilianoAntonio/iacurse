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
| `OPENAI_API_KEY` / `GEMINI_API_KEY` | según el `AI_PROVIDER` elegido (opcional; sin key hay fallbacks) |

### Cookies según el esquema (HTTPS vs HTTP)

- **Con HTTPS** (reverse proxy con TLS delante): dejar los defaults
  (`SESSION_COOKIE_SECURE=1`, `SAMESITE=None`). No hace falta definirlas.
- **HTTP plano** (piloto en red interna sin TLS): los navegadores rechazan
  cookies `Secure` y `SameSite=None` sin `Secure`. Definir en `.env`:

  ```env
  SESSION_COOKIE_SECURE=0
  CSRF_COOKIE_SECURE=0
  SESSION_COOKIE_SAMESITE=Lax
  CSRF_COOKIE_SAMESITE=Lax
  ```

Sin este ajuste el login no persiste (el navegador descarta la cookie).

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

Respaldo automatizado (script incluido en el repo, con retención de 30 días):

```bash
# Desde la raíz del proyecto en el servidor:
sh backend/scripts/backup.sh
# Cron diario sugerido (03:23) — los respaldos son además el archivo en frío
# de los logs de auditoría/telemetría (política de retención 12m + 24m):
#   23 3 * * *  cd /ruta/iacurse && sh backend/scripts/backup.sh >> /var/log/electromed-backup.log 2>&1
```

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
  lo sirve Django. Suficiente para la escala del piloto; con más carga,
  poner un reverse proxy (nginx/Caddy) sirviendo `/static/` y `/media/`.
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
- **TLS**: gratis con Caddy/nginx + Let's Encrypt, o Cloudflare (plan gratis).
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
   Security Groups de Lightsail, etc.), abrir TCP `3000` y `8000`
   (y `80`/`443` si luego se pone un proxy con TLS).

### 8.2 Firewall de la VM (ufw)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 3000/tcp
sudo ufw allow 8000/tcp
sudo ufw enable
```

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
# IA (opcional; sin key hay fallbacks)
OPENAI_API_KEY=...
```

```bash
docker compose up --build -d     # ~5 min la primera vez
docker compose ps                # los 3 servicios healthy
curl http://localhost:8000/api/health
```

App: `http://<IP>:3000`. Si más adelante hay dominio, poner Caddy delante
(puertos 80/443, TLS automático) y revertir las cookies a
`SECURE=1`/`SAMESITE=None`. **Con TLS operativo**, activar además en `.env`:

```env
SECURE_SSL_REDIRECT=1
SECURE_HSTS_SECONDS=31536000
```

Nota de seguridad: operar por HTTP plano expone credenciales y cookies de
sesión en tránsito; para información clasificada como Confidencial (datos
personales y registros académicos) la política institucional exige TLS 1.2+
— el despliegue definitivo debe ir detrás de HTTPS.

### 8.4 Respaldos

```bash
# Script del repo (retención 30 días, configurable con BACKUP_RETENTION_DAYS):
sh backend/scripts/backup.sh
# cron diario en la VM; copiar los .sql.gz periódicamente a otro lado (scp/drive)
```

Alternativa: activar los backups automáticos del proveedor (Hetzner/DO: +20%
del plan; OVH: incluidos). Para restaurar:

```bash
gunzip -c backups/electromed_YYYYMMDD_HHMMSS.sql.gz | docker compose exec -T db psql -U electromed -d electromed
```

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
