"use client";

import { DynamicIcon } from "@/components/app/dynamic-icon";
import { LogoMark } from "@/components/app/logo";
import { ShieldCheck, BookOpen } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-card">
      <div className="mx-auto max-w-6xl px-4 py-10 lg:px-8">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <LogoMark className="h-8 w-8 shadow-xs" />
              <span className="font-display text-sm font-bold tracking-tight">CAAMI</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Plataforma web con IA generativa para apoyar el aprendizaje personalizado
              en la asignatura de Electromedicina II.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-brand dark:text-brand-gold">
              <BookOpen className="h-3.5 w-3.5" />
              Proyecto
            </div>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>Piloto de Innovación Docente UVA24991</li>
              <li>Escuela de Ingeniería Civil Biomédica</li>
              <li>Facultad de Ingeniería, Universidad de Valparaíso</li>
            </ul>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-brand dark:text-brand-gold">
              <ShieldCheck className="h-3.5 w-3.5" />
              Consideraciones éticas
            </div>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>Participación voluntaria y consentimiento informado</li>
              <li>Datos anonimizados y resguardados</li>
              <li>Supervisión docente activa de respuestas IA</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Universidad de Valparaíso · Piloto de innovación docente</p>
          <p className="flex items-center gap-1.5">
            <DynamicIcon name="Sparkles" className="h-3 w-3 text-brand-gold" />
            IA generativa con mediación pedagógica
          </p>
        </div>
      </div>
    </footer>
  );
}
