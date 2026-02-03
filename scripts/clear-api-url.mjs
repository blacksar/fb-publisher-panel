#!/usr/bin/env node
/**
 * Borra la URL de la API de la base de datos (para quitar URL incorrecta).
 * Uso: node scripts/clear-api-url.mjs
 */

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  await prisma.setting.deleteMany({ where: { key: 'fb_api_url' } })
  console.log('✅ URL de la API eliminada. Configúrala en Ajustes.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
