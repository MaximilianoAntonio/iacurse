#!/bin/sh
# Respaldo diario CIFRADO de PostgreSQL — Plataforma Electromedicina II
# (hallazgo 2.14 del informe de seguridad oct-2026: respaldos cifrados,
# automatizados y almacenados fuera del servidor).
#
# Genera un dump comprimido y cifrado en ./backups (o BACKUP_DIR) con
# retención de BACKUP_RETENTION_DAYS días (default 30). Los respaldos son
# además la copia de "almacenamiento en frío" de los logs de auditoría y
# telemetría (2.9).
#
# Cifrado (elegir UNA vía; sin ninguna configurada el script ABORTA —
# los respaldos contienen datos confidenciales y no deben quedar en claro):
#   BACKUP_GPG_RECIPIENT  — cifrado asimétrico GPG hacia la clave pública del
#                           responsable (recomendado; la clave privada NO
#                           vive en el servidor).
#   BACKUP_PASSPHRASE     — cifrado simétrico AES-256 con OpenSSL.
#
# Uso manual:
#   sh backend/scripts/backup.sh                        (desde el host, vía docker compose exec)
#   docker compose exec db sh /scripts/backup.sh        (si se monta el script)
#
# Programación (cron en el VPS, desde la raíz del proyecto):
#   23 3 * * *  cd /ruta/iacurse && sh backend/scripts/backup.sh >> /var/log/electromed-backup.log 2>&1
#
# Copia fuera del servidor (OBLIGATORIA: respaldo en el mismo disco no es
# respaldo). Ejemplo con rsync hacia almacenamiento institucional:
#   rsync -a backups/ usuario@respaldo.institucional:/ruta/electromed/
#
# Restaurar:
#   # Con GPG (en un equipo que tenga la clave privada):
#   gpg -d backups/electromed_YYYYMMDD_HHMMSS.sql.gz.gpg | gunzip | docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
#   # Con OpenSSL:
#   openssl enc -d -aes-256-cbc -pbkdf2 -in backups/electromed_YYYYMMDD_HHMMSS.sql.gz.enc -pass env:BACKUP_PASSPHRASE | gunzip | docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
#
# PRUEBA DE RESTAURACIÓN (mensual, ver DEPLOY.md): restaurar el último
# respaldo en una base desechable y verificar que las tablas tienen datos:
#   docker compose exec db psql -U "$POSTGRES_USER" -c "CREATE DATABASE restore_test;"
#   <descifrar> | docker compose exec -T db psql -U "$POSTGRES_USER" -d restore_test
#   docker compose exec db psql -U "$POSTGRES_USER" -d restore_test -c "SELECT count(*) FROM accounts_user;"
#   docker compose exec db psql -U "$POSTGRES_USER" -c "DROP DATABASE restore_test;"
set -eu

BACKUP_DIR="${BACKUP_DIR:-backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
POSTGRES_USER="${POSTGRES_USER:-electromed}"
POSTGRES_DB="${POSTGRES_DB:-electromed}"
GPG_RECIPIENT="${BACKUP_GPG_RECIPIENT:-}"
PASSPHRASE="${BACKUP_PASSPHRASE:-}"

if [ -z "$GPG_RECIPIENT" ] && [ -z "$PASSPHRASE" ]; then
    echo "❌ Respaldo NO cifrado prohibido (hallazgo 2.14): define BACKUP_GPG_RECIPIENT o BACKUP_PASSPHRASE." >&2
    exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"

if [ -n "$GPG_RECIPIENT" ]; then
    FILE="$BACKUP_DIR/electromed_${STAMP}.sql.gz.gpg"
    echo "🗄️  Respaldando ${POSTGRES_DB} en ${FILE} (GPG → ${GPG_RECIPIENT}) ..."
    docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
        | gzip | gpg --batch --yes --trust-model always -e -r "$GPG_RECIPIENT" > "$FILE"
else
    FILE="$BACKUP_DIR/electromed_${STAMP}.sql.gz.enc"
    echo "🗄️  Respaldando ${POSTGRES_DB} en ${FILE} (OpenSSL AES-256) ..."
    docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
        | gzip | openssl enc -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE > "$FILE"
fi
echo "✅ Respaldo cifrado creado ($(du -h "$FILE" | cut -f1))."

# Retención: eliminar respaldos más antiguos que RETENTION_DAYS (ambos formatos)
find "$BACKUP_DIR" -name 'electromed_*.sql.gz.gpg' -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name 'electromed_*.sql.gz.enc' -mtime +"$RETENTION_DAYS" -delete
echo "🧹 Retención aplicada (${RETENTION_DAYS} días)."
echo "⚠️  Recuerda copiar ${FILE} fuera del servidor (rsync / almacenamiento institucional)."
