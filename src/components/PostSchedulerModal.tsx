"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import {
  X,
  Search,
  Plus,
  Pencil,
  Hash,
  Sparkles,
  MessageSquare,
  ImageIcon,
  Share2,
  Copy,
  Scissors,
  Bold,
  Italic,
  Smile,
  ChevronUp,
  Calendar,
  Clock,
  Loader2,
  Info,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet"
import { FacebookPostPreview } from "@/components/FacebookPostPreview"

export interface Page {
  id: string
  name: string
  is_selected?: boolean
}

export interface PostSchedulerFormData {
  page_id: string
  title: string
  content: string
  comment: string
  scheduled_at: string
  images: File[]
}

export interface ScheduledPostRef {
  page_id: string
  scheduled_at?: string | null
  status: string
}

export interface PostSchedulerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pagesList: Page[]
  formData: PostSchedulerFormData
  setFormData: React.Dispatch<React.SetStateAction<PostSchedulerFormData>>
  onSubmit: (action: "draft" | "publish" | "schedule") => void
  isSubmitting: boolean
  isSessionInactive?: boolean
  noPagesSelected?: boolean
  editingPost?: { page_name: string; image_url?: string } | null
  onClear?: () => void
  /** Posts con scheduled_at para calcular última programación por página */
  postsWithScheduled?: ScheduledPostRef[]
}

export function PostSchedulerModal({
  open,
  onOpenChange,
  pagesList,
  formData,
  setFormData,
  onSubmit,
  isSubmitting,
  isSessionInactive,
  noPagesSelected,
  editingPost,
  onClear,
  postsWithScheduled = [],
}: PostSchedulerModalProps) {
  const modalButtonsDisabled = isSubmitting || isSessionInactive || noPagesSelected
  const [searchQuery, setSearchQuery] = useState("")
  const [commentInputVisible, setCommentInputVisible] = useState(false)

  // Hora local en tiempo real
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!open) return
    setNow(new Date())
    const tid = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(tid)
  }, [open])

  // Mostrar campo comentario solo si tiene texto; ocultar cuando el usuario vacía el texto
  const prevOpenRef = useRef(false)
  const prevCommentRef = useRef(formData.comment ?? "")
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setCommentInputVisible(!!(formData.comment ?? "").trim())
    }
    prevOpenRef.current = open
  }, [open, formData.comment])
  useEffect(() => {
    const hasText = !!(formData.comment ?? "").trim()
    const hadText = !!(prevCommentRef.current ?? "").trim()
    if (hadText && !hasText) setCommentInputVisible(false) // usuario vació el texto
    prevCommentRef.current = formData.comment ?? ""
  }, [formData.comment])

  // Preview: primera imagen para la vista previa (o la de edición)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  useEffect(() => {
    if (formData.images?.length > 0) {
      const url = URL.createObjectURL(formData.images[0])
      setImagePreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    if (editingPost?.image_url) {
      setImagePreviewUrl(editingPost.image_url)
      return
    }
    setImagePreviewUrl(null)
  }, [formData.images, editingPost?.image_url])

  const filteredPages = useMemo(
    () =>
      pagesList.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [pagesList, searchQuery]
  )

  const selectedPage = pagesList.find((p) => p.id === formData.page_id)
  const previewPageName = selectedPage?.name ?? editingPost?.page_name ?? ""

  // Última programación PENDIENTE para la página (solo status "scheduled", no publicados)
  const lastScheduledForPage = useMemo(() => {
    if (!formData.page_id) return null
    const withScheduled = postsWithScheduled.filter(
      (p) => p.page_id === formData.page_id && p.scheduled_at && p.status === "scheduled"
    )
    if (withScheduled.length === 0) return null
    const sorted = [...withScheduled].sort(
      (a, b) => new Date(b.scheduled_at!).getTime() - new Date(a.scheduled_at!).getTime()
    )
    return sorted[0]
  }, [formData.page_id, postsWithScheduled])

  // Helper: Date → valor para datetime-local (YYYY-MM-DDTHH:mm)
  const toDatetimeLocalValue = (d: Date) => {
    const pad = (n: number) => n.toString().padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  // Establecer hora por defecto SOLO al abrir el modal o al cambiar de página (nunca sobrescribir fecha manual)
  const prevOpenAndPageRef = useRef({ open: false, pageId: "" })
  useEffect(() => {
    if (!open || editingPost || !formData.page_id) return
    const didOpen = !prevOpenAndPageRef.current.open && open
    const didChangePage = prevOpenAndPageRef.current.pageId !== formData.page_id
    prevOpenAndPageRef.current = { open, pageId: formData.page_id }

    if (!didOpen && !didChangePage) return

    const last = lastScheduledForPage
    if (!last?.scheduled_at) return // Solo ajustar si existe al menos un post programado para esta página

    const now = new Date()
    const lastDate = new Date(last.scheduled_at)
    let defaultDate = new Date(lastDate.getTime() + 60 * 60 * 1000) // +1 hora
    defaultDate.setMinutes(0, 0, 0) // redondear a XX:00 (2:01 → 3:00)
    if (defaultDate <= now) {
      const targetHour = defaultDate.getHours()
      defaultDate = new Date(now)
      defaultDate.setHours(targetHour, 0, 0, 0)
      if (defaultDate <= now) defaultDate.setDate(defaultDate.getDate() + 1)
    }
    setFormData((prev) => ({
      ...prev,
      scheduled_at: toDatetimeLocalValue(defaultDate),
    }))
  }, [open, formData.page_id, editingPost, lastScheduledForPage])

  const handleClear = () => {
    if (onClear) {
      onClear()
    } else {
      setFormData((prev) => ({
        ...prev,
        title: "",
        content: "",
        comment: "",
        images: [],
      }))
    }
  }

  const handleMediaClick = () => {
    ;(document.getElementById("post-scheduler-image-input") as HTMLInputElement)?.click()
  }

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    setFormData((prev) => ({
      ...prev,
      images: [...(prev.images ?? []), ...Array.from(files)],
    }))
    e.target.value = ""
  }

  const handleRemoveImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: (prev.images ?? []).filter((_, i) => i !== index),
    }))
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    if (modalButtonsDisabled) return
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) {
          setFormData((prev) => ({
            ...prev,
            images: [...(prev.images ?? []), file],
          }))
        }
        break
      }
    }
  }

  // URLs para miniaturas (revocar al desmontar o cambiar imágenes)
  const [thumbUrls, setThumbUrls] = useState<string[]>([])
  const prevThumbUrlsRef = useRef<string[]>([])
  useEffect(() => {
    prevThumbUrlsRef.current.forEach((u) => URL.revokeObjectURL(u))
    prevThumbUrlsRef.current = []
    const imgs = formData.images ?? []
    const urls = imgs.map((f) => URL.createObjectURL(f))
    prevThumbUrlsRef.current = urls
    setThumbUrls(urls)
    return () => {
      prevThumbUrlsRef.current.forEach((u) => URL.revokeObjectURL(u))
      prevThumbUrlsRef.current = []
    }
  }, [formData.images])

  const handleAgregarComentarioClick = () => {
    setCommentInputVisible(true)
    setTimeout(() => document.getElementById("post-scheduler-comment-input")?.focus(), 50)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="z-[100] flex h-full w-[95vw] max-w-7xl flex-col gap-0 border-l p-0 sm:max-w-7xl [&>button]:hidden"
      >
        <div className="flex h-full overflow-hidden" onPaste={handlePaste}>
          {/* Columna izquierda: selector de páginas */}
          <div className="flex w-56 shrink-0 flex-col border-r border-border bg-muted/30">
            {noPagesSelected && (
              <div className="mx-2 mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                Ve a <strong>Mis Páginas</strong> y selecciona al menos una página para publicar.
              </div>
            )}
            <div className="p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar página"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={modalButtonsDisabled}
                  className="bg-background pl-9 text-sm"
                />
              </div>
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto px-2">
              {filteredPages.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => {
                    if (modalButtonsDisabled) return
                    setFormData((prev) => ({ ...prev, page_id: page.id }))
                    if (typeof window !== "undefined") {
                      localStorage.setItem("lastSelectedPageId", page.id)
                    }
                  }}
                  disabled={modalButtonsDisabled}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    modalButtonsDisabled ? "cursor-not-allowed opacity-50" : "hover:bg-muted"
                  } ${formData.page_id === page.id ? "bg-muted" : ""}`}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/20 text-primary text-xs">
                      {page.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate text-foreground">{page.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Columna central: editor */}
          <div className="flex flex-1 flex-col min-w-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground"
                onClick={handleClear}
                disabled={modalButtonsDisabled}
              >
                <Pencil className="h-4 w-4" />
                Limpiar
              </Button>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-4 py-3">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 bg-transparent text-sm"
                type="button"
                disabled={modalButtonsDisabled}
              >
                <Pencil className="h-3 w-3" />
                Agregar etiquetas
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4">
              <div className="flex min-h-[280px] flex-col rounded-lg border border-border bg-card">
                <div className="flex flex-1 flex-col p-4">
                  <textarea
                    id="post-scheduler-content"
                    value={formData.content}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        content: e.target.value,
                      }))
                    }
                    disabled={modalButtonsDisabled}
                    placeholder="Escribe algo o usa shortcodes, spintax, @ para mencionar..."
                    className="min-h-[120px] flex-1 resize-none bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                <div className="border-t border-border p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Hash className="h-3 w-3" />
                        Hashtags
                      </Badge>
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Sparkles className="h-3 w-3" />
                        Asistente de IA
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="h-7 w-7" type="button" disabled={modalButtonsDisabled}>
                        <Bold className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" type="button" disabled={modalButtonsDisabled}>
                        <Italic className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" type="button" disabled={modalButtonsDisabled}>
                        <Smile className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border p-3">
                  <input
                    id="post-scheduler-image-input"
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleMediaChange}
                    disabled={modalButtonsDisabled}
                  />
                  <div className="flex flex-wrap gap-2">
                    {/* Miniatura de imagen al editar (cuando no hay File nuevos) */}
                    {editingPost?.image_url && (formData.images ?? []).length === 0 && (
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md border-2 border-primary bg-primary/5">
                        {imagePreviewUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={imagePreviewUrl} alt="" className="h-full w-full object-cover" />
                        ) : null}
                        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                      </div>
                    )}
                    {/* Miniaturas de fotos añadidas */}
                    {(formData.images ?? []).map((file, index) => (
                      <div
                        key={`${file.name}-${index}`}
                        className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md border-2 border-primary bg-muted/30"
                      >
                        {thumbUrls[index] ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={thumbUrls[index]}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                        <button
                          type="button"
                          onClick={() => !modalButtonsDisabled && handleRemoveImage(index)}
                          disabled={modalButtonsDisabled}
                          className={`absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white ${modalButtonsDisabled ? "cursor-not-allowed opacity-50" : "hover:bg-black/80"}`}
                          aria-label="Quitar imagen"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          disabled={modalButtonsDisabled}
                          className={`absolute bottom-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white ${modalButtonsDisabled ? "cursor-not-allowed opacity-50" : "hover:bg-black/80"}`}
                          aria-label="Descripción de imagen"
                        >
                          <MessageSquare className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {/* Botón + para añadir más - indica estado seleccionado cuando hay imagen */}
                    <button
                      type="button"
                      onClick={() => !modalButtonsDisabled && handleMediaClick()}
                      disabled={modalButtonsDisabled}
                      className={`relative flex h-20 w-20 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${modalButtonsDisabled ? "cursor-not-allowed opacity-50 border-dashed border-muted-foreground/40 bg-muted/20 text-muted-foreground" : (formData.images?.length > 0 || editingPost?.image_url) ? "cursor-pointer border-2 border-primary bg-primary/10 text-primary" : "cursor-pointer border-dashed border-muted-foreground/40 bg-muted/20 text-muted-foreground hover:border-muted-foreground/60 hover:bg-muted/30"}`}
                    >
                      <Plus className="h-8 w-8" />
                      {(formData.images?.length > 0 || editingPost?.image_url) && (
                        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  </div>
                  <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Info className="h-3.5 w-3.5 shrink-0" />
                    Para seleccionar un álbum específico, usa el botón &quot;Opciones de medios&quot; a continuación.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full justify-center bg-transparent text-sm"
                    type="button"
                    disabled={modalButtonsDisabled}
                  >
                    Opciones de medios
                  </Button>
                </div>

                {/* Agregar comentario: misma posición que en la referencia (debajo de media, encima del toolbar) */}
                <div className="border-t border-border">
                  <button
                    type="button"
                    onClick={() => !modalButtonsDisabled && handleAgregarComentarioClick()}
                    disabled={modalButtonsDisabled}
                    className={`flex w-full items-center gap-3 p-4 text-left transition-colors ${modalButtonsDisabled ? "cursor-not-allowed opacity-50" : "hover:bg-muted/30"}`}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1877f2] text-white">
                      <span className="text-lg font-bold">f</span>
                    </div>
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Plus className="h-4 w-4" />
                      Agregar comentario
                    </span>
                  </button>
                  {commentInputVisible && (
                    <div className="border-t border-border px-4 pb-3 pt-2">
                      <textarea
                        id="post-scheduler-comment-input"
                        value={formData.comment ?? ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            comment: e.target.value,
                          }))
                        }
                        disabled={modalButtonsDisabled}
                        placeholder="Escribe tu comentario..."
                        rows={3}
                        className="w-full resize-none rounded-none border-0 bg-transparent px-0 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-0 shadow-none"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 border-t border-border p-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" type="button" disabled={modalButtonsDisabled}>
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" type="button" disabled={modalButtonsDisabled}>
                    <span className="text-lg">@</span>
                  </Button>
                  <Separator orientation="vertical" className="mx-1 h-5" />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" type="button" onClick={() => !modalButtonsDisabled && handleMediaClick()} disabled={modalButtonsDisabled}>
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" type="button" disabled={modalButtonsDisabled}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Separator orientation="vertical" className="mx-1 h-5" />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" type="button" disabled={modalButtonsDisabled}>
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" type="button" disabled={modalButtonsDisabled}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Separator orientation="vertical" className="mx-1 h-5" />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" type="button" disabled={modalButtonsDisabled}>
                    <Scissors className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Footer acciones: fijo en la parte inferior del centro */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap" title={typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : ""}>
                    <Clock className="h-3.5 w-3.5" />
                    Tu hora: {now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                  </span>
                  <Input
                    type="datetime-local"
                    value={formData.scheduled_at}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        scheduled_at: e.target.value,
                      }))
                    }
                    disabled={modalButtonsDisabled}
                    className="h-9 w-auto min-w-[180px] text-sm"
                  />
                  <span className="hidden text-muted-foreground sm:inline">
                    <Calendar className="mr-1 inline h-4 w-4" />
                    Programar
                  </span>
                </div>
                {lastScheduledForPage?.scheduled_at && (
                  <span className="text-xs text-muted-foreground">
                    Última programación: {new Date(lastScheduledForPage.scheduled_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                  </span>
                )}
                {formData.scheduled_at && (
                  <span className="text-xs font-medium text-foreground/90">
                    Se programará: {(() => {
                      const d = new Date(formData.scheduled_at)
                      if (Number.isNaN(d.getTime())) return formData.scheduled_at
                      const pad = (n: number) => n.toString().padStart(2, "0")
                      const h24 = `${pad(d.getHours())}:${pad(d.getMinutes())}`
                      return `${d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} a las ${h24} (24h)`
                    })()}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onSubmit("draft")}
                  disabled={modalButtonsDisabled}
                >
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Guardar idea
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-primary bg-transparent text-primary hover:bg-primary/10"
                  onClick={() => onSubmit("publish")}
                  disabled={modalButtonsDisabled}
                >
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Publicar
                </Button>
                <div className="flex">
                  <Button
                    size="sm"
                    className="rounded-r-none bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => onSubmit("schedule")}
                    disabled={modalButtonsDisabled || !formData.scheduled_at}
                  >
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Programar
                  </Button>
                  <Button
                    size="sm"
                    className="rounded-l-none border-l border-primary-foreground/20 bg-primary px-2 text-primary-foreground hover:bg-primary/90"
                    type="button"
                    title="Programar"
                    disabled={modalButtonsDisabled}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Columna derecha: vista previa estilo Facebook */}
          <div className="min-w-[340px] w-[340px] shrink-0 border-l border-border bg-muted/20">
            <div className="p-4">
              <h3 className="text-sm font-medium text-foreground">
                Vista previa de la publicación
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Así se verá en la página seleccionada
              </p>
            </div>
            <div className="px-4 pb-4">
              <FacebookPostPreview
                pageName={previewPageName || "Selecciona una página"}
                content={formData.content}
                imageUrl={imagePreviewUrl}
                title={formData.title || undefined}
                comment={formData.comment ?? ""}
                secondaryText="Ahora mismo"
              />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
