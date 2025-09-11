#!/bin/bash
set -euo pipefail

echo "Waiting for database to be ready..."
until nc -z db 3306; do
  echo "Database not ready, waiting..."
  sleep 2
done
echo "Database is ready!"

echo "Generating Prisma client..."
npx prisma generate || yarn prisma generate || true

echo "Running Prisma migrations..."
if ! npx prisma migrate deploy; then
  echo "migrate deploy failed; attempting prisma db push (dev-safe)"
  npx prisma db push
fi

echo "Starting NestJS application in development mode..."
exec yarn start:dev

