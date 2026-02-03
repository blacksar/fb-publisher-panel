#!/bin/sh
set -e

# 1. Aplica migraciones pendientes (bloqueante)
npx prisma migrate deploy

# 2. Arranca Next.js en segundo plano
npm start &

# 3. Arranca Supercronic en primer plano (mantiene vivo el contenedor)
exec /usr/local/bin/supercronic /cronfile
