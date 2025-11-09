#!/bin/bash
set -e

echo "Waiting for database..."
until pg_isready -h db -p 5432 -U postgres; do
  sleep 1
done
echo "Database is ready!"

echo "Running migrations..."
python manage.py migrate

echo "Starting server..."
exec "$@"

