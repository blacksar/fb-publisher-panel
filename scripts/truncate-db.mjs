#!/usr/bin/env node
/**
 * Trunca todas las tablas de la base de datos para iniciar pruebas desde 0.
 * Uso: npm run truncate-db
 */

import mysql from 'mysql2/promise'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

function loadEnv() {
  const envPath = join(process.cwd(), '.env')
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf8')
    content.split('\n').forEach((line) => {
      const eq = line.indexOf('=')
      if (eq > 0) {
        const key = line.slice(0, eq).trim()
        const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
        if (!process.env[key]) process.env[key] = val
      }
    })
  }
}

loadEnv()

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL no está definida.')
    process.exit(1)
  }

  const tables = ['Post', 'FBPage', 'FBSession', 'Setting']

  console.log('⚠️  Truncando todas las tablas...')

  try {
    const connection = await mysql.createConnection(databaseUrl)

    await connection.query('SET FOREIGN_KEY_CHECKS = 0')

    for (const table of tables) {
      await connection.query(`TRUNCATE TABLE \`${table}\``)
      console.log(`   ✓ ${table}`)
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1')
    await connection.end()

    console.log('✅ Base de datos truncada correctamente.')
  } catch (error) {
    console.error('❌ Error truncando la base de datos:', error.message)
    process.exit(1)
  }
}

main()
