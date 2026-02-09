"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  Upload,
  Trash2,
  Copy,
  RefreshCw,
  Search,
  ImageIcon,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface MediaItem {
  name: string
  path: string
  size: number
  mtime: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function MediaPage() {
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<MediaItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchMedia = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/media/list", { cache: "no-store" })
      const data = await res.json()
      if (data.status === "ok") setItems(data.items || [])
      else toast.error(data.mensaje || "Error al cargar")
    } catch {
      toast.error("Error al cargar medios")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchMedia()
  }, [fetchMedia])

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      const formData = new FormData()
      for (let i = 0; i < files.length; i++) {
        formData.append("file", files[i])
      }
      const res = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (data.status === "ok") {
        toast.success(`${data.uploaded?.length || 0} archivo(s) subido(s)`)
        void fetchMedia()
      } else {
        toast.error(data.mensaje || "Error al subir")
      }
    } catch {
      toast.error("Error al subir archivos")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/media/delete?path=${encodeURIComponent(deleteTarget.path)}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (data.status === "ok") {
        toast.success("Archivo eliminado")
        setItems((prev) => prev.filter((i) => i.path !== deleteTarget.path))
        setDeleteTarget(null)
      } else {
        toast.error(data.mensaje || "Error al eliminar")
      }
    } catch {
      toast.error("Error al eliminar")
    } finally {
      setDeleting(false)
    }
  }

  const copyUrl = (path: string) => {
    const url = typeof window !== "undefined" ? `${window.location.origin}${path}` : path
    navigator.clipboard.writeText(url)
    toast.success("URL copiada")
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }
  const onDragLeave = () => setIsDragging(false)
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleUpload(e.dataTransfer.files)
  }

  return (
    <div className="space-y-6">
      <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Biblioteca de medios
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por nombre..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-white dark:bg-gray-800"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => void fetchMedia()}
                disabled={loading}
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Zona de subida */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={cn(
              "relative rounded-xl border-2 border-dashed p-8 text-center transition-colors",
              isDragging
                ? "border-primary bg-primary/5"
                : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
            )}
          >
            <input
              ref={fileInputRef}
              id="media-upload-input"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              multiple
              className="sr-only"
              onChange={(e) => handleUpload(e.target.files)}
              disabled={uploading}
            />
            <label
              htmlFor="media-upload-input"
              className={cn("cursor-pointer block", uploading && "pointer-events-none")}
            >
            {uploading ? (
              <div className="flex flex-col items-center gap-2 text-gray-500">
                <Loader2 className="h-10 w-10 animate-spin" />
                <span>Subiendo...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-gray-600 dark:text-gray-400">
                <Upload className="h-10 w-10" />
                <p className="font-medium">Arrastra imágenes aquí o haz clic para seleccionar</p>
                <p className="text-sm">JPEG, PNG, GIF, WebP. Máx. 10 MB por archivo</p>
              </div>
            )}
            </label>
          </div>

          {/* Grid de medios */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse"
                />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center text-gray-500 dark:text-gray-400">
              <ImageIcon className="h-16 w-16 mx-auto mb-4 opacity-40" />
              <p className="font-medium">
                {searchTerm ? "No hay resultados" : "No hay archivos subidos"}
              </p>
              <p className="text-sm mt-1">
                {searchTerm ? "Prueba otro término de búsqueda" : "Sube imágenes para comenzar"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredItems.map((item) => (
                <div
                  key={item.path}
                  className="group relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary/50 transition-colors"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.path}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                    <p className="text-white text-xs truncate" title={item.name}>
                      {item.name}
                    </p>
                    <p className="text-white/70 text-xs">{formatSize(item.size)}</p>
                    <div className="flex gap-1 mt-2">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          copyUrl(item.path)
                        }}
                        title="Copiar URL"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        className="h-8 w-8 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteTarget(item)
                        }}
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {items.length > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {filteredItems.length} de {items.length} archivo(s)
            </p>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => !deleting && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este archivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará {deleteTarget?.name}. Si está en uso en alguna publicación, la imagen
              podría no mostrarse correctamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
