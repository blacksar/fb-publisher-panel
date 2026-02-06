/**
 * Crea la base de datos si no existe.
 * Conecta a MySQL sin especificar DB, ejecuta CREATE DATABASE IF NOT EXISTS,
 * y luego cierra. Prisma migrate deploy creará las tablas.
 *
 * Uso: node scripts/init-db.mjs
 * Requiere: DATABASE_URL (ej. mysql://user:pass@host:3306/nombre_db)
 */
import mysql from 'mysql2/promise'

async function loadEnv() {
    if (process.env.DATABASE_URL) return
    try {
        const { readFileSync } = await import('fs')
        const { join } = await import('path')
        const envPath = join(process.cwd(), '.env')
        const content = readFileSync(envPath, 'utf8')
        for (const line of content.split('\n')) {
            const m = line.match(/^\s*([^#=]+)=(.*)$/)
            if (m) {
                const key = m[1].trim()
                const val = m[2].replace(/^["']|["']$/g, '').trim()
                if (!process.env[key]) process.env[key] = val
            }
        }
    } catch (e) {
        console.log('ℹ️ .env no encontrado o no legible, usando variables de entorno.')
    }
}

async function main() {
    await loadEnv()
    let databaseUrl = (process.env.DATABASE_URL || '').replace(/^["'\s]+|["'\s]+$/g, '')
    if (!databaseUrl) {
        console.error('❌ DATABASE_URL no está definida. Configúrala en .env')
        process.exit(1)
    }

    let connectionParams
    let dbName
    try {
        const url = new URL(databaseUrl.replace(/^mysql:/, 'http:'))
        dbName = decodeURIComponent((url.pathname || '/').replace(/^\/+|\/+$/g, '').split('?')[0]).replace(/["']+$/g, '').replace(/^["']+/g, '')
        if (!dbName) {
            console.error('❌ No se encontró nombre de base de datos en DATABASE_URL.')
            process.exit(1)
        }
        connectionParams = {
            host: url.hostname || 'localhost',
            port: url.port ? parseInt(url.port) : 3306,
            user: url.username || 'root',
            password: url.password || '',
        }
    } catch (e) {
        console.error('❌ Error parseando DATABASE_URL:', e.message)
        process.exit(1)
    }

    console.log(`⏳ Conectando y creando base de datos '${dbName}' si no existe...`)

    try {
        const connection = await mysql.createConnection(connectionParams)
        await connection.query(
            `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
        )
        console.log(`✅ Base de datos '${dbName}' verificada/creada.`)
        await connection.end()
    } catch (error) {
        console.error('❌ Error:', error.message)
        if (error.code === 'ECONNREFUSED') {
            console.error('   Asegúrate de que MySQL está corriendo y el host/puerto son correctos.')
        } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('   Revisa usuario y contraseña en DATABASE_URL.')
        }
        process.exit(1)
    }
}

main()
