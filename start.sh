#!/bin/sh
set -e
export TZ=UTC

# 1. Crea la base de datos si no existe (requiere permisos CREATE en MySQL)
npm run init-db

# 2. Aplica migraciones (crea tablas)
npx prisma migrate deploy

# 3. Arranca Next.js en segundo plano
npm run start:app &

# 4. Supercronic en primer plano (mantiene vivo el contenedor)
exec /usr/local/bin/supercronic /cronfile
