"use client";

import * as React from "react";
import { ZoomIn } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

// Imagen del contenido del curso: click para ampliar en un diálogo y pie de
// figura cuando el alt es descriptivo (un alt que parece nombre de archivo,
// p. ej. "IMG_2041.png", no se muestra como caption).
interface ContentImageProps {
  src?: string;
  alt?: string;
}

const FILENAME_RE = /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i;

export function ContentImage({ src, alt }: ContentImageProps) {
  const [open, setOpen] = React.useState(false);
  const caption = alt && !FILENAME_RE.test(alt.trim()) ? alt : null;

  return (
    <>
      <figure className="my-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative block w-full cursor-zoom-in"
          aria-label={caption ? `Ampliar imagen: ${caption}` : "Ampliar imagen"}
        >
          <img
            src={src}
            alt={alt || ""}
            loading="lazy"
            className="max-w-full rounded-xl border border-border shadow-sm transition-opacity group-hover:opacity-95"
          />
          <span className="absolute bottom-2 right-2 rounded-md bg-brand-ink/80 p-1.5 text-primary-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
            <ZoomIn className="h-3.5 w-3.5" aria-hidden />
          </span>
        </button>
        {caption && (
          <figcaption className="mt-2 text-center font-mono text-xs text-muted-foreground">
            {caption}
          </figcaption>
        )}
      </figure>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl gap-2 p-3">
          <DialogTitle className="sr-only">{caption ?? "Imagen ampliada"}</DialogTitle>
          <img
            src={src}
            alt={alt || ""}
            className="max-h-[80vh] w-full rounded-lg object-contain"
          />
          {caption && (
            <p className="px-1 pb-1 text-center font-mono text-xs text-muted-foreground">{caption}</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
