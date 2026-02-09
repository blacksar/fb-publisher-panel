
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    // No insertar URL por defecto: debe configurarse en Ajustes
    console.log('✅ Seed completado (fb_api_url debe configurarse en Ajustes).')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
