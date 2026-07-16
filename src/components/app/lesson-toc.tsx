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
    <nav className={cn("rounded-xl border-2 border-[#003366]/15 bg-[#003366]/5 p-3.5", className)}>
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between gap-2 text-sm font-bold uppercase tracking-wide text-[#003366] dark:text-amber-400 transition-colors hover:text-[#004488] dark:hover:text-amber-300"
      >
        <span className="flex items-center gap-1.5">
          <List className="h-4 w-4" />
          Contenido
        </span>
        <span className="text-xs font-semibold normal-case tracking-normal text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">
          {tocItems.length} secciones
        </span>
      </button>
      {!collapsed && (
        <ul className="mt-3 space-y-1 border-l-2 border-[#003366]/10 pl-3">
          {tocItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => handleClick(item.id)}
                className={cn(
                  "block w-full py-1.5 text-left text-sm transition-colors rounded-md px-2",
                  item.level === 3 ? "pl-4" : "pl-2 font-medium",
                  activeId === item.id
                    ? "bg-[#003366]/10 text-[#003366] dark:bg-amber-400/10 dark:text-amber-400 font-semibold"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <span className="block truncate">
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
