"use client";

// Utilidades compartidas para el contenido Markdown de unidades y lecciones.
// Unifican lo que antes estaba duplicado (y divergente) entre lesson-view y
// unit-detail-view: split por cabeceras H2, separación de las preguntas de
// control y los componentes de renderizado de react-markdown.

import * as React from "react";
import { resolveMediaSrc, videoEmbedUrl, VideoEmbed } from "@/lib/markdown-media";

/**
 * Slug de ancla para headings de lecciones. Debe ser IDÉNTICA en quien asigna
 * los ids (markdownComponents / splitContentSections) y en el TOC que navega
 * a ellos (lesson-toc.tsx la re-exporta desde aquí).
 */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ---------- secciones por H2 ----------

export interface ContentSection {
  title: string;
  id: string; // slug del H2 (ancla del TOC)
  body: string;
  headingIds: string[]; // id del H2 + ids de los H3 internos
}

/**
 * Divide el markdown por cabeceras H2: el texto previo al primer H2 queda
 * como introducción y cada sección H2 se convierte en una sección con su
 * ancla. Un H1 inicial se descarta (el título ya lo muestra el PageHeader).
 */
export function splitContentSections(markdown: string): { intro: string; sections: ContentSection[] } {
  const withoutH1 = markdown.replace(/^\s*#\s+[^\n]*(\n|$)/, "");
  const chunks = withoutH1.split(/(?=^##\s+[^#\n]+)/m);
  let intro = "";
  const sections: ContentSection[] = [];

  for (const chunk of chunks) {
    if (chunk.trim().startsWith("## ")) {
      const lines = chunk.split("\n");
      const title = lines[0].replace(/^##\s+/, "").replace(/[*_`~]/g, "").trim();
      const body = lines.slice(1).join("\n").trim();
      const id = slugifyHeading(title);
      const headingIds = [id];
      // Recoger los H3 internos para que el TOC pueda expandir la sección
      let inCodeBlock = false;
      for (const line of body.split("\n")) {
        if (line.trim().startsWith("```")) {
          inCodeBlock = !inCodeBlock;
          continue;
        }
        if (inCodeBlock) continue;
        const h3 = line.match(/^###\s+(.+)/);
        if (h3) headingIds.push(slugifyHeading(h3[1].replace(/[*_`~]/g, "").trim()));
      }
      sections.push({ title, id, body, headingIds });
    } else {
      intro += chunk;
    }
  }
  return { intro: intro.trim(), sections };
}

// ---------- checkpoints de comprensión ----------

/**
 * Cabecera que separa el contenido principal de las preguntas de control en
 * el contenido de unidad (la IA de personalización la respeta al adaptar).
 */
export const CHECKPOINT_SEPARATOR = "## 🔍 Preguntas de Control";

/**
 * Separa el markdown de una unidad en contenido principal y bloque de
 * preguntas de control. Tolerante: si el separador no existe, todo el texto
 * es contenido y no hay preguntas.
 */
export function splitCheckpoints(markdown: string): { main: string; questionsMarkdown: string } {
  const parts = markdown.split(CHECKPOINT_SEPARATOR);
  return { main: parts[0], questionsMarkdown: parts[1] || "" };
}

/**
 * Extrae las preguntas de control del bloque posterior al separador
 * (lista numerada o guiones; tolerante con formatos parciales).
 */
export function parseCheckpointQuestions(questionsMarkdown: string): string[] {
  if (!questionsMarkdown) return [];
  const questions: string[] = [];
  const matches = questionsMarkdown.match(/\d+\.\s*([^\n]+)/g);
  if (matches) {
    matches.forEach((m) => {
      questions.push(m.replace(/^\d+\.\s*/, "").trim());
    });
  } else {
    const lines = questionsMarkdown
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("1.") || l.startsWith("2.") || l.startsWith("-") || l.startsWith("¿"));
    lines.forEach((l) => {
      questions.push(l.replace(/^[-1234567890.\s]+/, "").trim());
    });
  }
  return questions.filter(Boolean);
}

// ---------- renderizado markdown ----------

// Clases prose compartidas (intro, secciones y fallback sin secciones)
export const PROSE_CLASSES =
  "prose prose-sm sm:prose-base max-w-none dark:prose-invert " +
  "prose-headings:scroll-mt-24 prose-h2:mt-8 prose-h2:mb-3 prose-h2:text-xl " +
  "prose-h3:mt-5 prose-h3:mb-2 prose-h3:text-lg prose-p:my-4 prose-p:leading-7 " +
  "prose-li:my-1.5 prose-strong:font-semibold " +
  "prose-code:rounded-md prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 " +
  "prose-code:font-mono prose-code:text-[0.85em] prose-code:font-medium " +
  "prose-code:text-brand dark:prose-code:text-brand-gold " +
  "prose-code:before:content-none prose-code:after:content-none";

// Texto plano de un heading (por si contiene formato inline como *cursiva*)
function headingText(children: React.ReactNode): string {
  return React.Children.toArray(children)
    .map((c) =>
      typeof c === "string" || typeof c === "number"
        ? String(c)
        : headingText((c as { props?: { children?: React.ReactNode } })?.props?.children)
    )
    .join("");
}

// Componentes markdown compartidos: ids de ancla en h2/h3 (misma función
// slug que el TOC), cajas destacadas con JetBrains Mono para código/fórmulas,
// embeds de video e imágenes del backend resueltas contra API_BASE.
export const markdownComponents = {
  h2: ({ children }: { children?: React.ReactNode }) => {
    const id = slugifyHeading(headingText(children));
    return <h2 id={id}>{children}</h2>;
  },
  h3: ({ children }: { children?: React.ReactNode }) => {
    const id = slugifyHeading(headingText(children));
    return <h3 id={id}>{children}</h3>;
  },
  // Bloque de código/fórmula: panel de lectura de instrumento en tinta azul
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="my-4 overflow-x-auto rounded-xl border border-brand-ink/60 bg-brand-ink p-4 font-mono text-[13px] leading-relaxed text-primary-foreground shadow-sm [&_code]:rounded-none [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-inherit">
      {children}
    </pre>
  ),
  // Cita/nota: caja ámbar suave, sin borde lateral grueso (regla del sistema)
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="my-4 rounded-lg bg-accent/50 px-4 py-3 text-sm text-accent-foreground [&_p]:my-1">
      {children}
    </blockquote>
  ),
  // Enlaces de video (YouTube/Vimeo) se embeben; el resto abre en pestaña nueva
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
    if (href && videoEmbedUrl(href)) {
      return <VideoEmbed href={href} title={typeof children === "string" ? children : undefined} />;
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand underline dark:text-brand-gold">
        {children}
      </a>
    );
  },
  // Imágenes: las subidas al backend (/media/...) se resuelven contra API_BASE
  img: ({ src, alt }: any) => (
    <img
      src={resolveMediaSrc(typeof src === "string" ? src : undefined)}
      alt={alt || ""}
      className="my-4 max-w-full rounded-xl border border-border shadow-sm"
      loading="lazy"
    />
  ),
};
