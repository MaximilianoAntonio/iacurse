#!/bin/sh
# Respaldo diario de PostgreSQL — Plataforma Electromedicina II
#
# Genera un dump comprimido en ./backups (o BACKUP_DIR) con retención de
# BACKUP_RETENTION_DAYS días (default 30). Los respaldos son además la copia
# de "almacenamiento en frío" de los logs de auditoría/telemetría (2.9).
#
# Uso manual:
#   docker compose exec db sh /scripts/backup.sh        (si se monta el script)
#   sh backend/scripts/backup.sh                        (desde el host, vía docker compose exec)
#
# Programación sugerida (cron en el VPS, desde la raíz del proyecto):
#   23 3 * * *  cd /ruta/iacurse && sh backend/scripts/backup.sh >> /var/log/electromed-backup.log 2>&1
#
# Restaurar:
#   gunzip -c backups/electromed_YYYYMMDD_HHMMSS.sql.gz | docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
set -eu

BACKUP_DIR="${BACKUP_DIR:-backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
POSTGRES_USER="${POSTGRES_USER:-electromed}"
POSTGRES_DB="${POSTGRES_DB:-electromed}"

mkdir -p "$BACKUP_DIR"
FILE="$BACKUP_DIR/electromed_$(date +%Y%m%d_%H%M%S).sql.gz"

echo "🗄️  Respaldando ${POSTGRES_DB} en ${FILE} ..."
docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$FILE"
echo "✅ Respaldo creado ($(du -h "$FILE" | cut -f1))."

# Retención: eliminar respaldos más antiguos que RETENTION_DAYS
find "$BACKUP_DIR" -name 'electromed_*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
echo "🧹 Retención aplicada (${RETENTION_DAYS} días)."
