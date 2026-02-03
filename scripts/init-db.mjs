
import mysql from 'mysql2/promise';

async function main() {
    if (!process.env.DATABASE_URL) {
        try {
            // Intenta cargar .env nativamente (Node.js 20+)
            process.loadEnvFile();
        } catch (e) {
            // Ignorar si falla, asumimos que variables ya están en el entorno o no hay .env
            console.log('ℹ️ No se pudo cargar .env o ya están definidas las variables.');
        }
    }

    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        console.error('❌ DATABASE_URL no está definida.');
        process.exit(1);
    }

    // Parsear URL básica: mysql://USER:PASSWORD@HOST:PORT/DB
    // Ejemplo: mysql://root:root@localhost:3306/fb_blacksar
    // Nota: Esto es un parser simple, podría necesitar librerías más robustas para casos complejos,
    // pero mysql2 suele manejar URLs de conexión standard.

    // Para crear la DB, necesitamos conectar sin seleccionar la DB específica primero,
    // o conectar a una DB default como 'mysql' o 'sys'.
    // Sin embargo, si tratamos de conectar directo a una DB que no existe, fallará.
    // Vamos a intentar parsear para obtener los credenciales y host.

    let connectionParams;
    let dbName;

    try {
        const url = new URL(databaseUrl);
        dbName = url.pathname.substring(1); // remover el slash inicial

        // Construir params para conectar SIN la base de datos target
        connectionParams = {
            host: url.hostname,
            port: url.port ? parseInt(url.port) : 3306,
            user: url.username,
            password: url.password,
        };
    } catch (e) {
        console.error('❌ Error parseando DATABASE_URL:', e);
        process.exit(1);
    }

    if (!dbName) {
        console.error('❌ No se encontró nombre de base de datos en DATABASE_URL.');
        process.exit(1);
    }

    console.log(`⏳ Verificando base de datos: ${dbName}...`);

    try {
        const connection = await mysql.createConnection(connectionParams);

        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
        console.log(`✅ Base de datos '${dbName}' verificada/creada.`);

        await connection.end();
    } catch (error) {
        console.error('❌ Error inicializando base de datos:', error);
        process.exit(1);
    }
}

main();
