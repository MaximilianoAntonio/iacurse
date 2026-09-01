# Backend Django — Plataforma Electromedicina II
# Lineamiento: Backend Python (Django)
FROM python:3.12-slim

# Variables de entorno
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DJANGO_SETTINGS_MODULE=config.settings.prod

# Dependencias del sistema para psycopg y compilación
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalar dependencias Python primero (mejor cache de Docker)
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copiar el resto del código
COPY . .

# Usuario no-root (hardening 2.3.1 d): la app no corre como root en el contenedor.
# Los directorios escribibles (media = subidas de docentes, staticfiles del
# collectstatic) quedan con su propietario correcto; el volumen media_data
# hereda esta propiedad al inicializarse.
RUN useradd --system --uid 10001 --create-home appuser \
    && mkdir -p /app/staticfiles /app/media \
    && chown -R appuser:appuser /app

# El entrypoint espera a Postgres, migra, carga fixtures y arranca el server
RUN chmod +x /app/entrypoint.sh

USER appuser

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
