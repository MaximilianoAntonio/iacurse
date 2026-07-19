#!/bin/bash
# ============================================================================
# dev-fullstack.sh — Orquesta backend Django + frontend Next.js en dev.
#
# Reemplaza al dev.sh anterior (que solo levantaba Next.js) para soportar la
# nueva arquitectura: Backend Python (Django) + Frontend React (Next.js).
#
# Uso:
#   .zscripts/dev-fullstack.sh           # levanta ambos
#   .zscripts/dev-fullstack.sh --docker  # levanta vía docker compose
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"

USE_DOCKER=0
if [ "${1:-}" = "--docker" ]; then
    USE_DOCKER=1
fi

pids=""

cleanup() {
    echo ""
    echo "🛑 Cerrando servicios..."
    for pid in $pids; do
        kill "$pid" 2>/dev/null || true
    done
    sleep 1
    for pid in $pids; do
        kill -9 "$pid" 2>/dev/null || true
    done
    echo "✅ Servicios cerrados."
}
trap cleanup EXIT INT TERM

# ---------------------------------------------------------------------------
# Modo Docker Compose (recomendado — usa PostgreSQL real)
# ---------------------------------------------------------------------------
if [ "$USE_DOCKER" -eq 1 ]; then
    echo "🐳 Iniciando con Docker Compose en modo DESARROLLO (con hot-reload)..."
    cd "$PROJECT_DIR"
    if [ ! -f .env ]; then
        echo "⚠️  No existe .env. Copiando de .env.example..."
        cp .env.example .env
        echo "   Edita .env con tus API keys antes de continuar."
    fi
    # Modo dev: hot-reload en backend y frontend
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
    exit 0
fi

# ---------------------------------------------------------------------------
# Modo local (sin Docker) — requiere PostgreSQL corriendo en localhost
# ---------------------------------------------------------------------------
echo "🚀 Modo local (sin Docker)"
echo "   Asegúrate de tener PostgreSQL corriendo en localhost:5432"
echo "   o usa: .zscripts/dev-fullstack.sh --docker"
echo ""

# --- Backend Django ---
if [ -d "$BACKEND_DIR" ]; then
    echo "🐍 Iniciando backend Django en :8000..."
    (
        cd "$BACKEND_DIR"
        # Activar venv si existe
        if [ -f .venv/bin/activate ]; then source .venv/bin/activate
        elif [ -f .venv/Scripts/activate ]; then source .venv/Scripts/activate
        fi
        # Migraciones + seed si la DB está vacía
        python manage.py migrate --noinput || true
        python manage.py seed_demo || true
        exec python manage.py runserver 0.0.0.0:8000
    ) > "$PROJECT_DIR/.zscripts/backend.log" 2>&1 &
    BACKEND_PID=$!
    pids="$BACKEND_PID"
    echo "   Backend PID: $BACKEND_PID (log: .zscripts/backend.log)"
    sleep 3
fi

# --- Frontend Next.js ---
echo "⚛️  Iniciando frontend Next.js en :3000..."
(
    cd "$PROJECT_DIR"
    if command -v bun >/dev/null 2>&1; then
        bun install
        exec bun run dev
    else
        npm install
        exec npm run dev
    fi
) > "$PROJECT_DIR/.zscripts/frontend.log" 2>&1 &
FRONTEND_PID=$!
pids="$FRONTEND_PID"
echo "   Frontend PID: $FRONTEND_PID (log: .zscripts/frontend.log)"

echo ""
echo "✅ Servicios iniciados:"
echo "   Frontend:  http://localhost:3000"
echo "   Backend:   http://localhost:8000"
echo "   Admin:     http://localhost:8000/admin"
echo ""
echo "💡 Presiona Ctrl+C para detener."
echo ""

# Esperar a que terminen
wait
