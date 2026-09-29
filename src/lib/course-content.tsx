"use client";

// Utilidades compartidas para el contenido Markdown de unidades y lecciones.
// Unifican lo que antes estaba duplicado (y divergente) entre lesson-view y
// unit-detail-view: split por cabeceras H2, separación de las preguntas de
// control y los componentes de renderizado de react-markdown.
//
// Reader 2.0: el pipeline soporta además tablas GFM, fórmulas KaTeX
// ($...$ / $$...$$), resaltado de sintaxis, callouts tipados
// (> [!nota|advertencia|seguridad|dato|ejemplo]) y fences especiales
// (```repaso → QuickCheck, ```glosario → GlossaryBlock). Todo es aditivo:
// el Markdown CommonMark existente se renderiza igual que antes.
// Las vistas deben usar <CourseMarkdown> (ya trae plugins + componentes).

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { resolveMediaSrc, videoEmbedUrl, VideoEmbed } from "@/lib/markdown-media";
import { CodeBlock } from "@/components/app/code-block";
import { Callout, type CalloutType } from "@/components/app/callout";
import { ContentImage } from "@/components/app/content-image";
import { QuickCheck } from "@/components/app/quick-check";
import { GlossaryBlock } from "@/components/app/glossary-block";
import type { ReadingFontSize } from "@/components/app/reading-controls";
import { Check, Hash } from "lucide-react";

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
const CHECKPOINT_SEPARATOR = "## 🔍 Preguntas de Control";

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

// ---------- helpers de contenido ----------

/** Texto plano de un árbol de nodos React (headings, código resaltado, etc.). */
export function extractText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (React.isValidElement(node)) {
    return extractText((node.props as { children?: React.ReactNode }).children);
  }
  return "";
}

/**
 * Estimación de minutos de lectura del contenido (palabras / 180 wpm, mín. 1).
 * Se usa como fallback cuando la lección no declara `durationMin` y para el
 * contenido adaptado de la unidad.
 */
export function estimateReadingMinutes(markdown: string): number {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, " ") // bloques de código completos
    .replace(/`[^`]*`/g, " ")
    .replace(/\$\$[\s\S]*?\$\$|\$[^$\n]*\$/g, " ") // fórmulas
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // imágenes
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // enlaces: queda el texto
    .replace(/^#+\s+/gm, "")
    .replace(/[>*_~|:-]/g, " ");
  const words = plain.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 180));
}

// ---------- renderizado markdown ----------

// Clases prose compartidas (intro, secciones y fallback sin secciones).
// `getProseClasses` permite al estudiante ajustar el tamaño de lectura
// (ReadingControls); PROSE_CLASSES queda como el tamaño por defecto.
const PROSE_TWEAKS =
  "prose-headings:scroll-mt-24 prose-h2:mt-8 prose-h2:mb-3 prose-h2:text-xl " +
  "prose-h3:mt-5 prose-h3:mb-2 prose-h3:text-lg prose-p:my-4 prose-p:leading-7 " +
  "prose-li:my-1.5 prose-strong:font-semibold " +
  "prose-code:rounded-md prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 " +
  "prose-code:font-mono prose-code:text-[0.85em] prose-code:font-medium " +
  "prose-code:text-brand dark:prose-code:text-brand-gold " +
  "prose-code:before:content-none prose-code:after:content-none";

export function getProseClasses(size: ReadingFontSize = "base"): string {
  const sizeClass =
    size === "sm" ? "prose-sm" : size === "lg" ? "prose-base sm:prose-lg" : "prose-sm sm:prose-base";
  return `prose ${sizeClass} max-w-none dark:prose-invert ${PROSE_TWEAKS}`;
}

export const PROSE_CLASSES = getProseClasses("base");

// Texto plano de un heading (por si contiene formato inline como *cursiva*)
function headingText(children: React.ReactNode): string {
  return extractText(children);
}

// Heading con ancla y botón para copiar el enlace directo a la sección
function AnchorHeading({ tag: Tag, children }: { tag: "h2" | "h3"; children?: React.ReactNode }) {
  const id = slugifyHeading(headingText(children));
  const [copied, setCopied] = React.useState(false);

  const copyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}#${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Portapapeles no disponible: el heading sigue siendo navegable
    }
  };

  return (
    <Tag id={id} className="group">
      {children}
      <button
        type="button"
        onClick={copyLink}
        aria-label={copied ? "Enlace copiado" : "Copiar enlace a esta sección"}
        title={copied ? "Enlace copiado" : "Copiar enlace a esta sección"}
        className="ml-2 inline-flex align-middle text-muted-foreground opacity-0 transition-opacity hover:text-brand focus-visible:opacity-100 group-hover:opacity-100 dark:hover:text-brand-gold"
      >
        {copied ? <Check className="h-4 w-4" /> : <Hash className="h-4 w-4" />}
      </button>
    </Tag>
  );
}

// Marca de callout al inicio de un blockquote: `> [!seguridad]`
const CALLOUT_MARKER = /^\s*\[!(nota|advertencia|seguridad|dato|ejemplo)\]\s*\n?/i;

/** ¿Queda contenido visible tras limpiar la marca? (para descartar <p> vacíos) */
function hasRenderableContent(node: React.ReactNode): boolean {
  if (node == null || typeof node === "boolean") return false;
  if (typeof node === "string" || typeof node === "number") return String(node).trim() !== "";
  if (Array.isArray(node)) return node.some(hasRenderableContent);
  if (React.isValidElement(node)) {
    if (node.type === "img" || node.type === "br" || node.type === "iframe") return true;
    // Las imágenes y videos del markdown ya llegan transformados por los
    // overrides de `markdownComponents` (ContentImage/VideoEmbed, sin children):
    // sin este check, un callout cuyo único contenido es una imagen o video
    // quedaría vacío al podar los párrafos "sin contenido".
    if (node.type === ContentImage || node.type === VideoEmbed) return true;
    return hasRenderableContent((node.props as { children?: React.ReactNode }).children);
  }
  return false;
}

/**
 * Detecta la marca `[!tipo]` en el primer texto del blockquote y devuelve los
 * children sin la marca (y sin párrafos que hayan quedado vacíos).
 */
function detectCallout(children: React.ReactNode): { type: CalloutType | null; cleaned: React.ReactNode } {
  let found: CalloutType | null = null;

  const walk = (node: React.ReactNode): React.ReactNode => {
    if (found) return node;
    if (typeof node === "string") {
      const m = node.match(CALLOUT_MARKER);
      if (m) {
        found = m[1].toLowerCase() as CalloutType;
        return node.replace(CALLOUT_MARKER, "");
      }
      return node;
    }
    if (Array.isArray(node)) return node.map((child) => walk(child));
    if (React.isValidElement(node)) {
      const kids = (node.props as { children?: React.ReactNode }).children;
      if (kids == null) return node;
      return React.cloneElement(node, undefined, walk(kids));
    }
    return node;
  };

  const cleaned = walk(children);
  if (!found) return { type: null, cleaned: children };

  const pruned = React.Children.toArray(cleaned).filter(hasRenderableContent);
  return { type: found, cleaned: pruned };
}

// Componentes markdown compartidos: ids de ancla en h2/h3 (misma función
// slug que el TOC), bloques de código con header + copiar, callouts tipados,
// tablas con scroll, embeds de video e imágenes con zoom.
export const markdownComponents = {
  h2: ({ children }: { children?: React.ReactNode }) => <AnchorHeading tag="h2">{children}</AnchorHeading>,
  h3: ({ children }: { children?: React.ReactNode }) => <AnchorHeading tag="h3">{children}</AnchorHeading>,
  // Bloque de código: fence con lenguaje → CodeBlock resaltado; los lenguajes
  // especiales (repaso/glosario) se convierten en bloques interactivos.
  pre: ({ children }: { children?: React.ReactNode }) => {
    const codeEl = React.Children.toArray(children)[0] as React.ReactElement | undefined;
    const codeProps = (codeEl?.props ?? {}) as { className?: string; children?: React.ReactNode };
    const lang = /language-([\w-]+)/.exec(codeProps.className ?? "")?.[1] ?? "";
    const plain = extractText(codeProps.children).replace(/\n$/, "");

    if (lang === "repaso") return <QuickCheck source={plain} />;
    if (lang === "glosario") return <GlossaryBlock source={plain} />;
    return (
      <CodeBlock language={lang} code={plain}>
        {children}
      </CodeBlock>
    );
  },
  // Cita: si abre con una marca [!tipo] es un callout semántico; si no, se
  // mantiene la caja ámbar suave de siempre (sin borde lateral grueso).
  blockquote: ({ children }: { children?: React.ReactNode }) => {
    const { type, cleaned } = detectCallout(children);
    if (type) return <Callout type={type}>{cleaned}</Callout>;
    return (
      <blockquote className="my-4 rounded-lg bg-accent/50 px-4 py-3 text-sm text-accent-foreground [&_p]:my-1">
        {children}
      </blockquote>
    );
  },
  // Tablas GFM: tarjeta con scroll horizontal y cabecera diferenciada
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-4 overflow-x-auto rounded-xl border border-border shadow-xs">
      <table className="w-full border-collapse text-sm tabular-nums [&_td]:border-t [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold">
        {children}
      </table>
    </div>
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
  // y se amplían al click (ContentImage)
  img: ({ src, alt }: any) => (
    <ContentImage src={resolveMediaSrc(typeof src === "string" ? src : undefined)} alt={alt} />
  ),
};

// Plugins del pipeline: GFM (tablas, tachado, listas de tareas) + math
// ($...$ / $$...$$) en remark; KaTeX y luego resaltado de sintaxis en rehype.
const REMARK_PLUGINS = [remarkGfm, remarkMath];
const REHYPE_PLUGINS = [rehypeKatex, rehypeHighlight];

/**
 * Render único del contenido del curso (lecciones, unidad adaptada, y
 * cualquier vista futura). Trae los plugins y componentes compartidos
 * enchufados; la vista solo decide las clases prose del contenedor.
 */
export function CourseMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS} components={markdownComponents}>
      {children}
    </ReactMarkdown>
  );
}
