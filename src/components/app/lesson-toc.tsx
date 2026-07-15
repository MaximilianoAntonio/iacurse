"use client";

import * as React from "react";
import { List, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TocItem {
  id: string;
  text: string;
  level: number; // 2 for h2, 3 for h3
}

interface LessonTocProps {
  content: string; // markdown content
  className?: string;
}

/**
 * Tabla de contenidos para lecciones.
 * Extrae los headings h2/h3 del markdown y permite navegación rápida.
 * Resalta la sección actual basándose en el scroll.
 */
export function LessonToc({ content, className }: LessonTocProps) {
  const [tocItems, setTocItems] = React.useState<TocItem[]>([]);
  const [activeId, setActiveId] = React.useState<string>("");
  const [collapsed, setCollapsed] = React.useState(false);

  // Extraer headings del markdown al montar
  React.useEffect(() => {
    const lines = content.split("\n");
    const items: TocItem[] = [];
    let inCodeBlock = false;
    for (const line of lines) {
      if (line.trim().startsWith("```")) {
        inCodeBlock = !inCodeBlock;
        continue;
      }
      if (inCodeBlock) continue;
      const match = line.match(/^(#{2,3})\s+(.+)/);
      if (match) {
        const level = match[1].length;
        const text = match[2].replace(/[*_`~]/g, "").trim();
        const id = text
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        items.push({ id, text, level });
      }
    }
    setTocItems(items);
  }, [content]);

  // Trackear la sección activa con IntersectionObserver
  React.useEffect(() => {
    if (tocItems.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
    );
    // Observar los headings renderizados en el DOM
    for (const item of tocItems) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [tocItems]);

  if (tocItems.length === 0) return null;

  const handleClick = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  return (
    <nav className={cn("rounded-xl border border-border bg-card p-3", className)}>
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
      >
        <span className="flex items-center gap-1.5">
          <List className="h-3.5 w-3.5" />
          Contenido
        </span>
        <span className="text-[10px] normal-case tracking-normal text-muted-foreground">
          {tocItems.length} secciones
        </span>
      </button>
      {!collapsed && (
        <ul className="mt-2 space-y-0.5 border-l border-border pl-2">
          {tocItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => handleClick(item.id)}
                className={cn(
                  "block w-full py-1 text-left text-xs transition-colors",
                  item.level === 3 ? "pl-3" : "pl-0 font-medium",
                  activeId === item.id
                    ? "text-[#003366] dark:text-amber-400"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span
                  className={cn(
                    "block truncate",
                    activeId === item.id && "border-l-2 border-[#003366] pl-2 -ml-2"
                  )}
                >
                  {item.text}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
