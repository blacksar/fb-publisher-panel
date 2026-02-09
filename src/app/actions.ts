'use server'

import { prisma } from '@/lib/prisma'
import { getCurrentUser, getEffectiveUserId } from '@/lib/auth'

async function sessionWhere() {
  const current = await getCurrentUser()
  if (!current) throw new Error('No autorizado')
  const effective = getEffectiveUserId(current)
  if (current.user.role === 'ADMIN' && !current.impersonationUserId) return {}
  return { userId: effective }
}

export async function getSessions() {
  const where = await sessionWhere()
  try {
    const sessions = await prisma.fBSession.findMany({
      where,
      orderBy: { created_at: 'desc' },
    })
    return sessions
  } catch (error) {
    console.error('Error fetching sessions:', error)
    throw new Error('Failed to fetch sessions')
  }
}

export async function createSession(data: {
  name: string
  cookie: string
  status: string
}) {
  const current = await getCurrentUser()
  if (!current) throw new Error('No autorizado')
  const effective = getEffectiveUserId(current)
  try {
    const session = await prisma.fBSession.create({
      data: {
        name: data.name,
        cookie: data.cookie,
        status: data.status,
        userId: effective,
      },
    })
    return session
  } catch (error) {
    console.error('Error creating session:', error)
    throw new Error('Failed to create session')
  }
}

export async function updateSession(id: number, data: {
  name?: string
  cookie?: string
  status?: string
  c_user?: string
  user_name?: string
}) {
  const where = await sessionWhere()
  try {
    const session = await prisma.fBSession.findFirst({
      where: { id, ...where },
    })
    if (!session) throw new Error('Sesión no encontrada')
    return prisma.fBSession.update({
      where: { id },
      data,
    })
  } catch (error) {
    console.error('Error updating session:', error)
    throw new Error('Failed to update session')
  }
}

export async function deleteSession(id: number) {
  const where = await sessionWhere()
  const session = await prisma.fBSession.findFirst({
    where: { id, ...where },
  })
  if (!session) throw new Error('Sesión no encontrada')
  try {
    await prisma.post.deleteMany({ where: { session_id: id } })
    await prisma.fBPage.deleteMany({ where: { session_id: id } })
    await prisma.fBSession.delete({ where: { id } })
  } catch (error) {
    console.error('Error deleting session:', error)
    throw new Error('Failed to delete session')
  }
}

import { publishToFacebook } from "@/lib/facebook"

export async function verifySession(id: number, data: {
  c_user: string
  user_name: string
  name?: string
}) {
  const where = await sessionWhere()
  const existing = await prisma.fBSession.findFirst({
    where: { id, ...where },
  })
  if (!existing) throw new Error('Sesión no encontrada')
  try {
    const session = await prisma.fBSession.update({
      where: { id },
      data: {
        ...data,
        status: 'verified',
        verified_at: new Date()
      }
    })

    // --- LOGICA AUTO-PUBLISH ---
    // Buscar posts pendientes de esta sesión
    const pendingPosts = await prisma.post.findMany({
      where: { session_id: id, status: 'pending' }
    })

    if (pendingPosts.length > 0) {
      // Ejecutar en background (no esperar para responder UI) - aunque Server Actions esperan.
      // Hacemos un Promise.all para procesar todos
      await Promise.all(pendingPosts.map(async (post: any) => {
        try {
          const result = await publishToFacebook({
            title: post.title,
            content: post.content,
            imageBase64: post.image_url || undefined,
            pageId: post.page_id
          }, session)

          if (result.success) {
            await prisma.post.update({
              where: { id: post.id },
              data: {
                status: 'published',
                published_at: new Date(),
                fb_post_id: result.fb_post_id
              }
            })
          } else {
            // Si falla de nuevo, se queda en failed con log estructurado
            const errorLog = result.errorLog
              ? JSON.stringify({ mensaje: result.error, respuesta_completa: result.errorLog })
              : JSON.stringify({ mensaje: result.error || "Auto-publish error" })

            await prisma.post.update({
              where: { id: post.id },
              data: {
                status: 'failed',
                error_log: errorLog
              }
            })
            console.error(`Auto-publish failed for post ${post.id}: ${result.error}`)
          }
        } catch (innerError: any) {
          // Catch individual post processing errors (e.g. DB crash)
          console.error(`Critical error processing pending post ${post.id}:`, innerError)
          try {
            await prisma.post.update({
              where: { id: post.id },
              data: {
                status: 'failed',
                error_log: JSON.stringify({ message: innerError.message, stack: innerError.stack, source: "Auto-publish Critical Error" })
              }
            })
          } catch (e) { console.error("Could not save error log to DB:", e) }
        }
      }))
    }

    return session
  } catch (error) {
    console.error('Error verifying session:', error)
    throw new Error('Failed to verify session')
  }
}

async function pageIdsForUser() {
  const where = await sessionWhere()
  const sessions = await prisma.fBSession.findMany({
    where,
    select: { id: true },
  })
  return sessions.map((s) => s.id)
}

export async function togglePageSelection(pageId: string, isSelected: boolean) {
  const sessionIds = await pageIdsForUser()
  try {
    await prisma.fBPage.updateMany({
      where: { id: pageId, session_id: { in: sessionIds } },
      data: { is_selected: isSelected },
    })
    return { success: true }
  } catch (error) {
    console.error('Error toggling page selection:', error)
    return { success: false }
  }
}

export async function addPagesToSelection(pageIds: string[]) {
  const sessionIds = await pageIdsForUser()
  try {
    await prisma.fBPage.updateMany({
      where: { id: { in: pageIds }, session_id: { in: sessionIds } },
      data: { is_selected: true },
    })
    return { success: true }
  } catch (error) {
    console.error('Error adding pages to selection:', error)
    return { success: false }
  }
}

export async function removePageFromSelection(pageId: string) {
  const sessionIds = await pageIdsForUser()
  try {
    await prisma.fBPage.updateMany({
      where: { id: pageId, session_id: { in: sessionIds } },
      data: { is_selected: false },
    })
    return { success: true }
  } catch (error) {
    console.error('Error removing page from selection:', error)
    return { success: false }
  }
}

export async function removePagesFromSelection(pageIds: string[]) {
  const sessionIds = await pageIdsForUser()
  try {
    await prisma.fBPage.updateMany({
      where: { id: { in: pageIds }, session_id: { in: sessionIds } },
      data: { is_selected: false },
    })
    return { success: true }
  } catch (error) {
    console.error('Error removing pages from selection:', error)
    return { success: false }
  }
} 