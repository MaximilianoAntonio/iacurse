"use client";

// Helpers para renderizar medios del contenido Markdown (imágenes subidas
// por docentes y videos enlazados de YouTube/Vimeo).
import { API_BASE } from "@/hooks/use-fetch";

// Resuelve la src de una imagen del markdown: las rutas de medios subidos
// (/media/...) viven en el backend; URLs absolutas y data: se dejan tal cual.
export function resolveMediaSrc(src?: string): string {
  if (!src) return "";
  if (/^https?:\/\//i.test(src) || src.startsWith("data:")) return src;
  return `${API_BASE}${src.startsWith("/") ? src : `/${src}`}`;
}

// Detecta URLs de video (YouTube/Vimeo) y devuelve la URL de embed, o null.
export function videoEmbedUrl(href?: string): string | null {
  if (!href) return null;
  const yt = href.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vimeo = href.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

// Embed responsivo 16:9 para videos enlazados en el contenido.
export function VideoEmbed({ href, title }: { href: string; title?: string }) {
  const embed = videoEmbedUrl(href);
  if (!embed) return null;
  return (
    <span className="my-4 block overflow-hidden rounded-xl border border-border bg-brand-ink shadow-sm">
      <span className="relative block aspect-video">
        <iframe
          src={embed}
          title={title || "Video de la lección"}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </span>
    </span>
  );
}
