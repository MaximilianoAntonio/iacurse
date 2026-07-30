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
| `DJANGO_SECRET_KEY` | generar uno nuevo: `python -c "import secrets; print(secrets.token_urlsafe(50))"` |
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

## 3. Build y arranque

```bash
docker compose up --build -d
docker compose ps        # los 3 servicios deben quedar healthy/running
docker compose logs -f backend
```

El entrypoint del backend espera a Postgres, corre `migrate`, `collectstatic`
y, si la base está vacía, carga fixtures + `seed_demo` (crea las cuentas demo
— **cambiar sus passwords o eliminarlas si no se quieren en producción**).

## 4. Verificación

- `curl http://localhost:8000/api/health` → `{"status": "ok", ...}`
- Frontend: `http://<servidor>:3000`
- Admin Django: `http://<servidor>:8000/admin` (con CSS — servido por WhiteNoise)
- Login con una cuenta demo y navegación básica.

## 5. Datos persistentes

Dos volúmenes nombrados; respaldarlos para no perder información:

- `postgres_data` — base de datos completa.
- `media_data` — imágenes subidas por docentes desde el Course Builder.

Respaldo rápido de la base:

```bash
docker exec electromed-db pg_dump -U electromed electromed > backup.sql
```

## 6. Notas operativas

- Los estáticos del admin/DRF los sirve WhiteNoise desde gunicorn; `/media/`
  lo sirve Django. Suficiente para la escala del piloto; con más carga,
  poner un reverse proxy (nginx/Caddy) sirviendo `/static/` y `/media/`.
- `NEXT_PUBLIC_API_URL` se incrusta en el bundle en **build-time**:
  cambiarla requiere `docker compose up --build` (no basta reiniciar).
- Actualizar el código: `git pull && docker compose up --build -d`
  (las migraciones corren solas en el arranque del backend).
