"use client";

import { DynamicIcon } from "@/components/app/dynamic-icon";
import { ShieldCheck, HeartPulse, BookOpen } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-gradient-to-br from-[#003366]/5 via-background to-amber-50/30 dark:from-[#003366]/10 dark:via-background dark:to-amber-950/10">
      <div className="mx-auto max-w-6xl px-4 py-10 lg:px-8">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#003366] to-[#0066AA] text-amber-400">
                <HeartPulse className="h-4 w-4" />
              </div>
              <span className="text-sm font-bold">ElectroMed IA</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Plataforma web con IA generativa para apoyar el aprendizaje personalizado
              en la asignatura de Electromedicina II.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#003366] dark:text-amber-400">
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
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#003366] dark:text-amber-400">
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
            <DynamicIcon name="Sparkles" className="h-3 w-3 text-amber-500" />
            IA generativa con mediación pedagógica
          </p>
        </div>
      </div>
    </footer>
  );
}
