"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";

// Bloque de código del contenido del curso: "panel de instrumento" en tinta
// azul con barra superior (lenguaje + botón copiar). El resaltado de sintaxis
// lo aplica rehype-highlight sobre el <code> hijo; aquí solo se enmarca.
// Los lenguajes especiales (repaso/glosario) se interceptan antes, en
// course-content.tsx, y nunca llegan a este componente.

// Nombres legibles para los lenguajes frecuentes del curso
const LANGUAGE_LABELS: Record<string, string> = {
  c: "C",
  cpp: "C++",
  arduino: "Arduino",
  python: "Python",
  javascript: "JavaScript",
  typescript: "TypeScript",
  bash: "Terminal",
  shell: "Terminal",
  json: "JSON",
  html: "HTML",
  css: "CSS",
};

interface CodeBlockProps {
  // Lenguaje del fence (```cpp). Vacío si el bloque no declara lenguaje.
  language?: string;
  // Texto plano del bloque (para el portapapeles, sin tokens de resaltado).
  code: string;
  // El <code> ya resaltado que entrega react-markdown.
  children?: React.ReactNode;
}

export function CodeBlock({ language, code, children }: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);
  const label = language ? (LANGUAGE_LABELS[language] ?? language) : "código";

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Portapapeles no disponible (permisos del navegador): no se interrumpe la lectura
    }
  };

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-brand-ink/60 bg-brand-ink shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-primary-foreground/60">
          {label}
        </span>
        <button
          type="button"
          onClick={copyCode}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] text-primary-foreground/60 transition-colors hover:bg-white/10 hover:text-primary-foreground"
          aria-label={copied ? "Código copiado" : "Copiar código"}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-primary-foreground [&_code]:rounded-none [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-inherit">
        {children}
      </pre>
    </div>
  );
}
