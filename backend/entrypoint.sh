#!/bin/sh
# Entrypoint del backend Django.
# 1. Espera a que Postgres esté disponible.
# 2. Ejecuta migraciones.
# 3. Carga fixtures (datos demo) si la DB está vacía.
# 4. Arranca el servidor (gunicorn en prod, runserver en dev).
set -e

echo "⏳ Esperando PostgreSQL en ${POSTGRES_HOST:-db}:${POSTGRES_PORT:-5432}..."
until python -c "import socket,os,sys; s=socket.socket(); s.settimeout(2);
h=os.environ.get('POSTGRES_HOST','db'); p=int(os.environ.get('POSTGRES_PORT','5432'));
sys.exit(0 if (lambda: (s.connect((h,p)), s.close()))() is None else 1)" 2>/dev/null; do
    echo "  Postgres no listo, reintentando..."
    sleep 1
done
echo "✅ PostgreSQL disponible."

echo "📦 Ejecutando migraciones..."
python manage.py migrate --noinput

echo "🗂️  collectstatic..."
python manage.py collectstatic --noinput || true

# Cargar fixtures solo si no hay usuarios (DB vacía / recién migrada)
USERS_COUNT=$(python manage.py shell -c "from accounts.models import User; print(User.objects.count())" 2>/dev/null | tail -1)
if [ "$USERS_COUNT" = "0" ]; then
    echo "🌱 Base de datos vacía. Cargando fixtures demo..."
    for f in backend/fixtures/*.json fixtures/*.json; do
        if [ -f "$f" ]; then
            echo "  → $f"
            python manage.py loaddata "$f" || echo "  ⚠️  No se pudo cargar $f (continuando)"
        fi
    done
    # Seed demo vía management command si existe
    python manage.py seed_demo || echo "  ℹ️  seed_demo no disponible aún"
else
    echo "ℹ️  Base de datos ya tiene $USERS_COUNT usuario(s). Saltando carga de fixtures."
fi

# Modo dev: runserver; prod: gunicorn
if [ "$DJANGO_DEBUG" = "1" ] || [ "$1" = "dev" ]; then
    echo "🚀 Arrancando Django runserver (dev) en :8000..."
    exec python manage.py runserver 0.0.0.0:8000
else
    echo "🚀 Arrancando gunicorn (prod) en :8000..."
    exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 120
fi
