"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { usePathname } from "next/navigation"
// Removed motion import - no animations needed
import { Plus, ImageIcon, Calendar, Loader2, AlertTriangle, ExternalLink, Trash2, Edit, Send, MoreHorizontal } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { PostSchedulerModal } from "@/components/PostSchedulerModal"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import Image from "next/image"

interface Post {
  id: number
  title: string
  content: string
  status: "draft" | "scheduled" | "published" | "failed" | "pending"
  scheduled_at?: string
  published_at?: string
  image_url?: string
  page_name: string
  page_id: string
  fb_post_id?: string
  created_at: string
  error_log?: string
}

interface Page {
  id: string
  name: string
  is_selected?: boolean
}

interface SessionOption {
  id: number
  name: string
  user_name?: string | null
  status: string
}

// Mock data para páginas (basado en la respuesta que proporcionaste)
const mockPages: Page[] = [
  { id: "61576680081122", name: "Ta de pingamosa" },
  { id: "61576380624658", name: "Remedios al Natural" },
  { id: "61563597283860", name: "La chischis" },
  { id: "100066385706805", name: "Okplaya" },
  { id: "100080526758990", name: "Caramelozas" },
  { id: "100069546085818", name: "Blacksarbot" },
  { id: "61550800295904", name: "Melosas" },
  { id: "100069776196040", name: "It's You Video" },
  { id: "100062295083514", name: "The Blacksar Gamer" },
  { id: "61563363702342", name: "La chischi" },
  { id: "100068077009813", name: "Cariñozitas" },
  { id: "100088541232351", name: "La Chu Chu Pamela" },
  { id: "100063261488119", name: "LogicGamingdr" },
  { id: "61551101871086", name: "Cinefusion - Peliculas Gratis" },
]

// Mock data para posts
const mockPosts: Post[] = [
  {
    id: 1,
    title: "Promoción de Verano",
    content: "¡Aprovecha nuestras ofertas especiales de verano! Descuentos de hasta 50% en productos seleccionados.",
    status: "published",
    published_at: "2024-01-15T10:30:00Z",
    image_url: "/placeholder.svg?height=100&width=100",
    page_name: "Ta de pingamosa",
    page_id: "61576680081122",
    created_at: "2024-01-15T09:00:00Z",
  },
  {
    id: 2,
    title: "Nuevo Producto Disponible",
    content: "Te presentamos nuestro nuevo producto revolucionario que cambiará tu vida.",
    status: "scheduled",
    scheduled_at: "2024-01-20T15:00:00Z",
    image_url: "/placeholder.svg?height=100&width=100",
    page_name: "Remedios al Natural",
    page_id: "61576380624658",
    created_at: "2024-01-14T14:20:00Z",
  },
  {
    id: 3,
    title: "Tips de Salud",
    content: "Consejos importantes para mantener una vida saludable y equilibrada.",
    status: "draft",
    page_name: "Remedios al Natural",
    page_id: "61576380624658",
    created_at: "2024-01-13T11:15:00Z",
  },
  {
    id: 4,
    title: "Error en Publicación",
    content: "Este post tuvo un error al intentar publicarse automáticamente.",
    status: "failed",
    page_name: "La chischis",
    page_id: "61563597283860",
    created_at: "2024-01-12T16:45:00Z",
  },
  {
    id: 5,
    title: "Gaming News",
    content: "Las últimas noticias del mundo gaming que no te puedes perder.",
    status: "published",
    published_at: "2024-01-11T20:00:00Z",
    image_url: "/placeholder.svg?height=100&width=100",
    page_name: "The Blacksar Gamer",
    page_id: "100062295083514",
    created_at: "2024-01-11T18:30:00Z",
  },
]

// util fetch pages cached
async function getCachedPages(): Promise<Page[]> {
  try {
    const res = await fetch("/api/get-pages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
    const data = await res.json()
    if (data.status === "cached" || data.status === "updated") {
      return data.pages as Page[]
    }
    if (data.status === "ok") {
      const raw = data.resultado.resultado
      return JSON.parse(raw) as Page[]
    }
    return []
  } catch {
    return []
  }
}

async function fetchPostsFromServer(): Promise<Post[]> {
  try {
    const sessionIdStr = typeof window !== "undefined" ? localStorage.getItem("selectedSessionId") : null
    const payload = sessionIdStr ? { sessionId: parseInt(sessionIdStr, 10) } : {}
    const res = await fetch("/api/get-posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    })
    const data = await res.json()
    if (data.status === "ok") return data.posts as Post[]
    return []
  } catch {
    return []
  }
}

export function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<Post | null>(null)
  const [postToPublish, setPostToPublish] = useState<Post | null>(null)
  const [isPublishAlertOpen, setIsPublishAlertOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("published")
  const [errorLogPost, setErrorLogPost] = useState<Post | null>(null) // State for error dialog
  const [formData, setFormData] = useState({
    page_id: "",
    title: "",
    content: "",
    comment: "",
    scheduled_at: "",
    images: [] as File[],
  })
  const formDataRef = useRef(formData)
  formDataRef.current = formData
  const [pagesList, setPagesList] = useState<Page[]>([])
  const [sessions, setSessions] = useState<SessionOption[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | "">("")
  const [mounted, setMounted] = useState(false)
  const [sessionsLoaded, setSessionsLoaded] = useState(false)

  // Cargar valores de localStorage solo después de montar (evita hydration mismatch)
  useEffect(() => {
    setMounted(true)
  }, [])
  useEffect(() => {
    if (!mounted) return
    const storedPage = localStorage.getItem('lastSelectedPageId')
    if (storedPage) setFormData(prev => ({ ...prev, page_id: storedPage }))
  }, [mounted])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const pathname = usePathname()

  // Session guard
  const selectedSession = sessions.find(s => s.id.toString() === selectedSessionId)
  const isSessionInactive = selectedSession?.status === "inactive" || selectedSession?.status === "pending"
  const noAccountSelected = !selectedSessionId || sessions.length === 0
  const buttonsDisabled = noAccountSelected || isSessionInactive

  // Helpers para fechas (manejo UTC/local)
  const toUTCISOString = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toISOString()
  }

  const toDatetimeLocalValue = (value?: string | null) => {
    if (!value) return ""
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ""
    const pad = (num: number) => num.toString().padStart(2, "0")
    const year = date.getFullYear()
    const month = pad(date.getMonth() + 1)
    const day = pad(date.getDate())
    const hours = pad(date.getHours())
    const minutes = pad(date.getMinutes())
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  // Reset form solo al abrir el modal (no al cerrar ni en re-renders); scheduled_at lo establece el modal
  const prevModalOpenRef = useRef(false)
  useEffect(() => {
    const didOpen = isModalOpen && !prevModalOpenRef.current
    prevModalOpenRef.current = isModalOpen
    if (didOpen && !editingPost) {
      setFormData(prev => ({
        ...prev,
        title: "",
        content: "",
        comment: "",
        images: [],
      }))
    }
    if (!isModalOpen) {
      setEditingPost(null)
    }
  }, [isModalOpen, editingPost])

  // Workaround: Radix Dialog/Sheet a veces deja pointer-events:none en body al cerrar y bloquea todos los clics
  useEffect(() => {
    if (!isModalOpen && typeof document !== "undefined") {
      const t = setTimeout(() => {
        document.body.style.pointerEvents = ""
        document.body.style.removeProperty?.("pointer-events")
      }, 400)
      return () => clearTimeout(t)
    }
  }, [isModalOpen])

  // Sessions: refetch al cargar, al volver a la pestaña y al navegar aquí (tras verificar en Cuentas)
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/list-sessions', { cache: 'no-store' })
      const data = await res.json()
      if (data.status === 'ok' && Array.isArray(data.sessions)) {
        const formattedSessions = data.sessions.map((session: any) => ({
          id: session.id,
          name: session.name,
          user_name: session.user_name,
          status: session.status
        }))
        setSessions(formattedSessions)
        if (formattedSessions.length > 0) {
          const stored = typeof window !== 'undefined' ? localStorage.getItem('selectedSessionId') : null
          const storedValid = stored && formattedSessions.some((s: any) => s.id.toString() === stored)
          if (storedValid) {
            setSelectedSessionId(stored)
          } else {
            const first = formattedSessions.find((s: any) => s.status === 'verified') || formattedSessions[0]
            setSelectedSessionId(first.id.toString())
            if (typeof window !== 'undefined') localStorage.setItem('selectedSessionId', first.id.toString())
          }
        }
      }
    } catch { /* silenciar */ }
    finally { setSessionsLoaded(true) }
  }, [])

  useEffect(() => {
    void fetchSessions()
  }, [fetchSessions, pathname])

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') void fetchSessions() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [fetchSessions])

  // Refetch posts al abrir el modal para tener datos frescos de la BD (última programación correcta)
  useEffect(() => {
    if (!isModalOpen || !selectedSessionId) return
    fetchPostsFromServer().then((p) => {
      if (Array.isArray(p)) setPosts(p)
    })
  }, [isModalOpen])

  // whenever session changes, load pages & posts
  useEffect(() => {
    ; (async () => {
      if (!selectedSessionId) {
        setPosts([])
        return
      }
      if (typeof window !== 'undefined') localStorage.setItem('selectedSessionId', selectedSessionId)

      // fetch pages
      try {
        const res = await fetch('/api/get-pages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: parseInt(selectedSessionId, 10) }) })
        const data = await res.json()
        if (data.status === 'cached' || data.status === 'updated') {
          const pages = Array.isArray(data.pages) ? data.pages : []
          setPagesList(pages.filter((p: Page) => p.is_selected))
        } else if (data.status === 'ok' && data.resultado?.resultado) {
          try {
            const fresh = JSON.parse(data.resultado.resultado) as Page[]
            setPagesList(Array.isArray(fresh) ? fresh.filter(p => p.is_selected !== false) : [])
          } catch {
            setPagesList([])
          }
        } else {
          setPagesList([])
        }
      } catch {
        setPagesList([])
      }

      // fetch posts
      try {
        const p = await fetchPostsFromServer()
        setPosts(Array.isArray(p) ? p : [])
      } catch {
        setPosts([])
      }
    })()
  }, [selectedSessionId])

  const handleSubmit = async (action: "publish" | "draft" | "schedule" = "publish") => {
    if (isSubmitting) return
    if (!formData.page_id || !formData.content.trim()) {
      toast.error("Por favor complete todos los campos requeridos (página y contenido de la publicación)")
      return
    }
    if (action === "schedule" && !formData.scheduled_at) {
      toast.error("Selecciona una fecha y hora para programar")
      return
    }

    try {
      setIsSubmitting(true)
      // Usar formDataRef para evitar clausuras obsoletas (ej. tras paste/async)
      const currentFormData = formDataRef.current
      const images = currentFormData.images ?? []
      let imageBase64: string | null = null
      if (images.length > 0) {
        const file = images[0]
        imageBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
      } else if (editingPost?.image_url) {
        imageBase64 = editingPost.image_url
      }

      const sessionIdStr = typeof window !== "undefined" ? localStorage.getItem("selectedSessionId") : null
      // Primer input (content) → title en API. Segundo input (comment) → comment en API.
      const payload: Record<string, unknown> = {
        pageId: currentFormData.page_id,
        title: currentFormData.content.trim(),
        comment: (currentFormData.comment ?? "").trim(),
        imageBase64,
      }
      if (editingPost) (payload as any).postId = editingPost.id
      if (sessionIdStr) payload.sessionId = parseInt(sessionIdStr, 10)
      if (currentFormData.scheduled_at) payload.scheduledAt = toUTCISOString(currentFormData.scheduled_at)

      const finalEndpoint = action === "schedule" ? "/api/schedule-post" : "/api/publish-post"
      if (action === "draft") (payload as any).save_draft = true

      const res = await fetch(finalEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (data.status === "ok") {
        const postStatus = data.post?.status
        const message = action === "draft"
          ? "Borrador actualizado"
          : action === "schedule"
            ? "Publicación programada exitosamente"
            : postStatus === "pending"
              ? "Sesión caducada. Post guardado como pendiente."
              : "Publicación actualizada exitosamente"

        const successMessage = action === "draft"
          ? "Guardado en borradores"
          : action === "schedule"
            ? "Publicación programada"
            : postStatus === "pending"
              ? "Sesión caducada. Post guardado como pendiente."
              : "Publicación exitosa"

        if (editingPost) {
          // Actualizar post existente en la lista
          setPosts((prev) => prev.map(p => p.id === editingPost.id ? (data.post as Post) : p))
          if (postStatus === 'pending') toast.warning(message)
          else toast.success(message)
        } else {
          // Agregar nuevo post
          setPosts((prev) => [
            data.post as Post,
            ...prev,
          ])
          if (postStatus === 'pending') toast.warning(successMessage)
          else toast.success(successMessage)
        }
      } else {
        toast.error(data.mensaje || "Error al publicar")
      }
    } catch (error) {
      console.error(error)
      toast.error("Error al publicar el post")
    } finally {
      setIsSubmitting(false)
    }

    setIsModalOpen(false)
  }

  const getStatusBadge = (status: string) => {
    const textColors = {
      draft: "text-gray-600 dark:text-gray-400",
      scheduled: "text-blue-600 dark:text-blue-400",
      published: "text-green-600 dark:text-green-400",
      failed: "text-red-600 dark:text-red-400",
      pending: "text-yellow-600 dark:text-yellow-400",
    } as const

    const labels = {
      draft: "Borrador",
      scheduled: "Programado",
      published: "Publicado",
      failed: "Fallido",
      pending: "Pendiente (Auto)",
    }

    return (
      <span className={`font-medium ${textColors[status as keyof typeof textColors]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    )
  }

  // Funciones de acciones para borradores y programados
  const handleDeletePost = async (post: Post) => {
    const msg = post.status === "draft" ? "¿Estás seguro de eliminar este borrador?" : "¿Estás seguro de eliminar esta publicación programada?"
    if (!confirm(msg)) return
    try {
      const res = await fetch("/api/delete-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id }),
      })
      const data = await res.json()
      if (data.status === "ok") {
        setPosts(prev => prev.filter(p => p.id !== post.id))
        toast.success(post.status === "draft" ? "Borrador eliminado" : "Publicación programada eliminada")
      } else {
        toast.error(data.mensaje || "Error al eliminar")
      }
    } catch {
      toast.error("Error al eliminar")
    }
  }

  const handlePublishDraft = async (post: Post) => {
    try {
      const sessionIdStr = typeof window !== "undefined" ? localStorage.getItem("selectedSessionId") : null
      const res = await fetch("/api/publish-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: post.id,
          sessionId: sessionIdStr ? parseInt(sessionIdStr, 10) : undefined,
          pageId: post.page_id,
          title: post.title,
          comment: post.content,
          imageBase64: post.image_url,
        }),
      })
      const data = await res.json()
      if (data.status === "ok") {
        // Actualizar el post en la lista
        setPosts(prev => prev.map(p => p.id === post.id ? data.post : p))
        toast.success("Publicado exitosamente")
      } else {
        toast.error(data.mensaje || "Error al publicar")
      }
    } catch {
      toast.error("Error al publicar el borrador")
    }
  }

  const handleEditPost = (post: Post) => {
    setEditingPost(post)
    setFormData({
      page_id: post.page_id,
      title: post.title,
      content: post.title,
      comment: post.content,
      scheduled_at: toDatetimeLocalValue(post.scheduled_at),
      images: [],
    })
    setIsModalOpen(true)
  }

  return (
    <div className="space-y-6">
      {sessionsLoaded && noAccountSelected && (
        <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Sin cuenta seleccionada</AlertTitle>
          <AlertDescription>
            Selecciona una cuenta en el menú o ve a <strong>Cuentas Sociales</strong> para agregar una.
          </AlertDescription>
        </Alert>
      )}
      {/* WARNING ALERT */}
      {sessionsLoaded && selectedSessionId && isSessionInactive && (
        <Alert variant="destructive" className="bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900 mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Cuenta Inactiva</AlertTitle>
          <AlertDescription>
            La cuenta seleccionada ha caducado o no está verificada. Por seguridad, las funciones de API están bloqueadas.
            Por favor, vaya a "Cuentas Sociales" y verifique la cuenta nuevamente para continuar.
          </AlertDescription>
        </Alert>
      )}
      <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 sm:gap-4">
            <CardTitle className="text-gray-900 dark:text-white pr-4">Gestión de Publicaciones</CardTitle>
            <Select
              value={selectedSessionId}
              onValueChange={(val) => {
                setSelectedSessionId(val)
                if (typeof window !== "undefined") localStorage.setItem("selectedSessionId", val)
              }}
            >
              <SelectTrigger className="w-48 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <SelectValue placeholder="Selecciona sesión" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()}>
                    {(s.user_name || s.name).split(" ")[0]} {s.status !== 'verified' && s.status !== 'active' ? '(Inactiva)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              className={buttonsDisabled ? "opacity-50 cursor-not-allowed" : "bg-[#2563eb] hover:bg-[#1d4ed8]"}
              disabled={buttonsDisabled}
              onClick={() => setIsModalOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Nueva Publicación
            </Button>
          </div>
        </CardHeader>

        <PostSchedulerModal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          pagesList={pagesList}
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          isSessionInactive={!!buttonsDisabled}
          noPagesSelected={!!selectedSessionId && pagesList.length === 0}
          editingPost={editingPost}
          postsWithScheduled={posts.map((p) => ({ page_id: p.page_id, scheduled_at: p.scheduled_at, status: p.status }))}
          onClear={() => {
            setFormData((prev) => ({ ...prev, title: "", content: "", comment: "", images: [] }))
          }}
        />

        <AlertDialog open={isPublishAlertOpen} onOpenChange={setIsPublishAlertOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {postToPublish?.status === "scheduled" ? "¿Publicar esta publicación programada ahora?" : "¿Publicar este borrador ahora?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Se publicará inmediatamente en la página seleccionada: <strong>{postToPublish?.page_name}</strong>.
                  {isSessionInactive && (
                    <div className="mt-2 p-2 bg-yellow-50 text-yellow-800 rounded text-sm border border-yellow-200">
                      Advertencia: La sesión parece inactiva. El post podría guardarse como "pendiente" si la sesión está caducada.
                    </div>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (postToPublish) handlePublishDraft(postToPublish)
                  }}
                  disabled={buttonsDisabled}
                  className={isSessionInactive ? "bg-yellow-600 hover:bg-yellow-700" : "bg-green-600 hover:bg-green-700"}
                >
                  {isSubmitting ? "Publicando..." : (isSessionInactive ? "Intentar Publicar" : "Publicar Inmediatamente")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        {/* Error Log Dialog */}
        <Dialog open={!!errorLogPost} onOpenChange={(open) => !open && setErrorLogPost(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-red-600 flex items-center gap-2">
                <AlertTriangle /> Detalle del Error
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="font-medium text-gray-900 dark:text-gray-100">
                El post "{errorLogPost?.title}" falló con el siguiente registro:
              </p>
              <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded text-xs font-mono whitespace-pre-wrap overflow-x-auto text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
                {errorLogPost?.error_log ?
                  (() => {
                    try { return JSON.stringify(JSON.parse(errorLogPost.error_log), null, 2) }
                    catch { return errorLogPost.error_log }
                  })()
                  : "No hay detalle disponible."}
              </pre>
            </div>
            <DialogFooter>
              <Button onClick={() => setErrorLogPost(null)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="published">
                Publicados ({posts.filter((p) => p.status === "published").length})
              </TabsTrigger>
              <TabsTrigger value="draft">Borradores ({posts.filter((p) => p.status === "draft").length})</TabsTrigger>
              <TabsTrigger value="scheduled">
                Programados ({posts.filter((p) => p.status === "scheduled").length})
              </TabsTrigger>
              <TabsTrigger value="pending">
                Pendientes ({posts.filter((p) => p.status === "pending").length})
              </TabsTrigger>
              <TabsTrigger value="failed">Fallidos ({posts.filter((p) => p.status === "failed").length})</TabsTrigger>
            </TabsList>

            {["published", "draft", "scheduled", "pending", "failed"].map((status) => (
              <TabsContent key={status} value={status}>
                <div className="rounded-md border border-gray-200 dark:border-gray-800">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Imagen</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead>Página</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Fecha</TableHead>
                        {(status === "draft" || status === "scheduled") && <TableHead>Acciones</TableHead>}
                        {status === "failed" && <TableHead>Detalle Error</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {posts.filter((post) => post.status === status).length > 0 ? (
                        posts.filter((post) => post.status === status).map((post: Post) => (
                          <TableRow
                            key={post.id}
                            className="border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                          >
                            <TableCell>
                              {post.image_url ? (
                                <Image
                                  src={post.image_url || "/placeholder.svg"}
                                  alt=""
                                  width={48}
                                  height={48}
                                  className="object-cover rounded"
                                />
                              ) : (
                                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center">
                                  <ImageIcon className="w-6 h-6 text-gray-400" />
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-gray-900 dark:text-gray-100 max-w-[200px]">
                                {post.title.length > 30 ? `${post.title.slice(0, 30)}…` : post.title}
                              </div>
                            </TableCell>
                            <TableCell className="text-gray-900 dark:text-gray-100 font-medium">
                              <a
                                href={`https://www.facebook.com/${post.page_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                {post.page_name}
                              </a>
                            </TableCell>
                            <TableCell>{getStatusBadge(post.status)}</TableCell>
                            <TableCell className="text-gray-900 dark:text-gray-100">
                              {post.published_at
                                ? new Date(post.published_at).toLocaleString()
                                : post.scheduled_at
                                  ? new Date(post.scheduled_at).toLocaleString()
                                  : new Date(post.created_at).toLocaleString()}
                            </TableCell>
                            {post.status === "draft" ? (
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => {
                                      if (!buttonsDisabled) {
                                        setPostToPublish(post)
                                        setIsPublishAlertOpen(true)
                                      }
                                    }}
                                    disabled={buttonsDisabled}
                                    className={`text-green-600 dark:text-green-400 hover:text-green-500 ${buttonsDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                                    title={buttonsDisabled ? (noAccountSelected ? "Selecciona una cuenta" : "Sesión inactiva") : "Publicar ahora"}
                                  >
                                    <Send className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => !buttonsDisabled && handleEditPost(post)}
                                    disabled={buttonsDisabled}
                                    className={`text-blue-600 dark:text-blue-400 hover:text-blue-500 ${buttonsDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                                    title={buttonsDisabled ? "Selecciona una cuenta" : "Editar"}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => !buttonsDisabled && handleDeletePost(post)}
                                    disabled={buttonsDisabled}
                                    className={`text-red-600 dark:text-red-400 hover:text-red-500 ${buttonsDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                                    title={buttonsDisabled ? "Selecciona una cuenta" : "Eliminar"}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </TableCell>
                            ) : post.status === "scheduled" ? (
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0" disabled={buttonsDisabled}>
                                      <span className="sr-only">Abrir menú</span>
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => !buttonsDisabled && handleEditPost(post)} disabled={buttonsDisabled}>
                                      <Edit className="mr-2 h-4 w-4" />
                                      Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => { if (!buttonsDisabled) { setPostToPublish(post); setIsPublishAlertOpen(true) } }} disabled={buttonsDisabled}>
                                      <Send className="mr-2 h-4 w-4" />
                                      Publicar ahora
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => !buttonsDisabled && handleDeletePost(post)} disabled={buttonsDisabled} className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400">
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Eliminar
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            ) : status === "failed" ? (
                              <TableCell>
                                {post.error_log && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setErrorLogPost(post)}
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <AlertTriangle className="w-4 h-4 mr-1" /> Ver Error
                                  </Button>
                                )}
                              </TableCell>
                            ) : (
                              <TableCell>
                                {post.fb_post_id && (
                                  <a
                                    href={`https://www.facebook.com/${post.fb_post_id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 dark:text-blue-400 hover:text-blue-500"
                                    title="Ver en Facebook"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={(status === "draft" || status === "scheduled" || status === "failed") ? 6 : 5} className="h-24 text-center text-gray-500 dark:text-gray-400">
                            No hay publicaciones en esta categoría.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
