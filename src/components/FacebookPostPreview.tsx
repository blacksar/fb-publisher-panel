"use client"

import { ThumbsUp, MessageCircle, Share2, MoreHorizontal } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export interface FacebookPostPreviewProps {
  pageName: string
  pageAvatarUrl?: string | null
  content: string
  imageUrl?: string | null
  title?: string
  /** Comentario de la página: se muestra en burbuja gris debajo del post */
  comment?: string
  /** Texto secundario en cabecera, ej. "Ahora mismo" o vacío */
  secondaryText?: string
  className?: string
}

export function FacebookPostPreview({
  pageName,
  pageAvatarUrl,
  content,
  imageUrl,
  title,
  comment,
  secondaryText = "Ahora mismo",
  className,
}: FacebookPostPreviewProps) {
  const initial = pageName.charAt(0).toUpperCase()
  // Usar solo content para el post principal; title solo si es distinto (evita duplicación)
  const mainText = (content?.trim() || title?.trim() || "").trim()

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card text-card-foreground overflow-hidden shadow-sm",
        className
      )}
    >
      {/* Cabecera: Avatar + nombre + "Ahora mismo" + menú */}
      <div className="flex items-start gap-3 p-3">
        <Avatar className="h-10 w-10 shrink-0 bg-[#1877f2]/20">
          {pageAvatarUrl ? (
            <AvatarImage src={pageAvatarUrl} alt={pageName} />
          ) : null}
          <AvatarFallback className="bg-[#1877f2]/30 text-[#1877f2] text-sm font-bold">
            {initial}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground text-[15px]">
            {pageName}
          </p>
          <p className="text-xs text-muted-foreground">{secondaryText}</p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted"
          aria-label="Más opciones"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>

      {/* Cuerpo: título y contenido como texto principal del post */}
      <div className="px-3 pb-3">
        {mainText ? (
          <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-foreground">
            {mainText}
          </p>
        ) : (
          <p className="text-muted-foreground text-sm italic">
            Escribe algo para la publicación...
          </p>
        )}
      </div>

      {/* Imagen */}
      {imageUrl ? (
        <div className="w-full overflow-hidden border-t border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Vista previa"
            className="h-auto w-full object-cover"
          />
        </div>
      ) : null}

      {/* Barra Me gusta · Comentar · Compartir */}
      <div className="flex items-center justify-around border-t border-border py-1">
        <button
          type="button"
          className="flex flex-1 items-center justify-center gap-2 py-2 text-muted-foreground hover:bg-muted/50 text-[15px]"
        >
          <ThumbsUp className="h-4 w-4" />
          <span>Me gusta</span>
        </button>
        <button
          type="button"
          className="flex flex-1 items-center justify-center gap-2 py-2 text-muted-foreground hover:bg-muted/50 text-[15px]"
        >
          <MessageCircle className="h-4 w-4" />
          <span>Comentar</span>
        </button>
        <button
          type="button"
          className="flex flex-1 items-center justify-center gap-2 py-2 text-muted-foreground hover:bg-muted/50 text-[15px]"
        >
          <Share2 className="h-4 w-4" />
          <span>Compartir</span>
        </button>
      </div>

      {/* Comentario de la página: avatar + burbuja gris */}
      {comment?.trim() ? (
        <div className="flex items-start gap-2 px-3 pb-3 pt-1">
          <Avatar className="h-8 w-8 shrink-0 bg-[#1877f2]/20">
            {pageAvatarUrl ? (
              <AvatarImage src={pageAvatarUrl} alt={pageName} />
            ) : null}
            <AvatarFallback className="bg-[#1877f2]/30 text-[#1877f2] text-xs font-bold">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 rounded-2xl rounded-tl-sm bg-muted/80 px-3 py-2">
            <p className="whitespace-pre-wrap break-words text-[13px] leading-snug text-foreground">
              {comment.trim()}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
