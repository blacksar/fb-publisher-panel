
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const settings = await prisma.setting.findMany()
    console.log("Settings found:", settings)

    const target = await prisma.setting.findUnique({ where: { key: 'fb_api_url' } })
    console.log("Target keys 'fb_api_url':", target)
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect())
