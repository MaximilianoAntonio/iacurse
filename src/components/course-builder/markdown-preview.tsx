"use client";

import * as React from "react";
import { resolveMediaSrc, videoEmbedUrl } from "@/lib/markdown-media";

/**
 * Renderizador ligero de Markdown a HTML para vistas previas.
 * Soporta: encabezados, negrita/cursiva, listas, código, citas, enlaces, tablas simples, HR.
 * No requiere dependencias externas — pensado para previews rápidos en el editor.
 */
export function MarkdownPreview({ content, className }: { content: string; className?: string }) {
  const html = React.useMemo(() => renderMarkdown(content || ""), [content]);
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderMarkdown(src: string): string {
  if (!src.trim()) {
    return '<p class="text-muted-foreground italic text-sm">No hay contenido para previsualizar.</p>';
  }

  const lines = src.split(/\r?\n/);
  const out: string[] = [];
  let inList = false;
  let inOl = false;
  let inCode = false;
  let codeBuf: string[] = [];
  let inQuote = false;

  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
    if (inOl) {
      out.push("</ol>");
      inOl = false;
    }
  };
  const closeQuote = () => {
    if (inQuote) {
      out.push("</blockquote>");
      inQuote = false;
    }
  };

  for (const raw of lines) {
    const line = raw;

    // Bloque de código cercado
    if (line.trim().startsWith("```")) {
      if (inCode) {
        out.push(`<pre class="rounded-md bg-muted p-3 my-2 overflow-x-auto text-xs"><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`);
        codeBuf = [];
        inCode = false;
      } else {
        closeList();
        closeQuote();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }

    // Línea vacía
    if (!line.trim()) {
      closeList();
      closeQuote();
      continue;
    }

    // HR
    if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
      closeList();
      closeQuote();
      out.push('<hr class="my-3 border-border" />');
      continue;
    }

    // Encabezados
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      closeList();
      closeQuote();
      const lvl = h[1].length;
      const sizes = ["text-xl", "text-lg", "text-base", "text-sm", "text-sm", "text-xs"];
      out.push(`<h${lvl} class="font-bold mt-3 mb-1.5 ${sizes[lvl - 1]}">${inline(h[2])}</h${lvl}>`);
      continue;
    }

    // Cita
    if (line.startsWith("> ")) {
      closeList();
      if (!inQuote) {
        // Uso legítimo de blockquote: el borde izquierdo grueso es la convención de citas, no una alerta.
        out.push('<blockquote class="border-l-4 border-brand/40 pl-3 my-2 italic text-muted-foreground text-sm">');
        inQuote = true;
      }
      out.push(`<p>${inline(line.slice(2))}</p>`);
      continue;
    } else {
      closeQuote();
    }

    // Lista ordenada
    const ol = /^\s*(\d+)\.\s+(.*)$/.exec(line);
    if (ol) {
      if (!inOl) {
        closeList();
        out.push('<ol class="list-decimal pl-5 my-2 space-y-1 text-sm">');
        inOl = true;
      }
      out.push(`<li>${inline(ol[2])}</li>`);
      continue;
    }

    // Lista no ordenada
    const ul = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (ul) {
      if (!inList) {
        closeList();
        out.push('<ul class="list-disc pl-5 my-2 space-y-1 text-sm">');
        inList = true;
      }
      out.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }

    // Tabla simple (| a | b |)
    if (line.startsWith("|") && line.endsWith("|")) {
      closeList();
      closeQuote();
      const cells = line.slice(1, -1).split("|").map((c) => c.trim());
      // Separador de tabla | --- | --- |
      if (cells.every((c) => /^[-:]+$/.test(c))) continue;
      const tag = "td";
      out.push(
        `<table class="my-2 w-full border-collapse text-sm"><tr>${cells
          .map((c) => `<${tag} class="border border-border p-1.5">${inline(c)}</${tag}>`)
          .join("")}</tr></table>`
      );
      continue;
    }

    // Párrafo
    closeList();
    closeQuote();
    out.push(`<p class="my-1.5 text-sm leading-relaxed">${inline(line)}</p>`);
  }

  // Cerrar pendientes
  if (inCode) {
    out.push(`<pre class="rounded-md bg-muted p-3 my-2 overflow-x-auto text-xs"><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`);
  }
  closeList();
  closeQuote();

  return out.join("\n");
}

function inline(s: string): string {
  let r = escapeHtml(s);
  // Imágenes ![alt](src) — antes que enlaces; /media/... se resuelve al backend
  r = r.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (_m, alt, src) =>
      `<img src="${resolveMediaSrc(src)}" alt="${alt}" class="my-3 max-w-full rounded-lg border border-border" loading="lazy" />`
  );
  // Código en línea
  r = r.replace(/`([^`]+)`/g, '<code class="rounded bg-muted px-1 py-0.5 text-xs font-mono">$1</code>');
  // Negrita
  r = r.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // Cursiva
  r = r.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  // Enlaces [texto](url): los videos de YouTube/Vimeo se embeben en 16:9
  r = r.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text, href) => {
    const embed = videoEmbedUrl(href);
    if (embed) {
      return `<span class="my-3 block aspect-video overflow-hidden rounded-lg border border-border bg-black"><iframe src="${embed}" title="${text}" class="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></span>`;
    }
    return `<a href="${href}" class="text-primary underline underline-offset-2 hover:text-primary/80" target="_blank" rel="noopener noreferrer">${text}</a>`;
  });
  return r;
}
