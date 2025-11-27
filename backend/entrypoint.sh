#!/bin/bash
set -e

# Get database host from environment variable
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

# If DATABASE_URL is provided, parse it to get DB_HOST
if [ -n "$DATABASE_URL" ]; then
    # Extract host from DATABASE_URL (format: postgres://user:pass@host:port/dbname)
    DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    if [ -z "$DB_HOST" ]; then
        DB_HOST="localhost"
    fi
    DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    if [ -z "$DB_PORT" ]; then
        DB_PORT="5432"
    fi
fi

echo "Waiting for database at $DB_HOST:$DB_PORT..."
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U postgres 2>/dev/null || pg_isready -h "$DB_HOST" -p "$DB_PORT" 2>/dev/null; do
  echo "Database not ready, waiting..."
  sleep 2
done
echo "Database is ready!"

# Skip migrations and collectstatic if SKIP_MIGRATIONS is set
if [ -z "$SKIP_MIGRATIONS" ]; then
    echo "Collecting static files..."
    python manage.py collectstatic --noinput || echo "Warning: Static file collection failed"

    echo "Running migrations..."
    python manage.py migrate
else
    echo "Skipping migrations and collectstatic (SKIP_MIGRATIONS is set)"
fi

echo "Starting server..."
exec "$@"

