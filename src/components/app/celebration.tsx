"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CelebrationProps {
  /** Cuando es true, muestra la celebración */
  trigger: boolean;
  /** Título del logro */
  title: string;
  /** Descripción/subtítulo */
  description?: string;
  /** Puntos ganados (opcional) */
  points?: number;
  /** Callback al cerrar */
  onClose: () => void;
  /** Color del acento (clase tailwind gradient) */
  accentGradient?: string;
}

/**
 * Modal de celebración con confeti animado para logros y completitud de unidades.
 * Usa framer-motion para animaciones, sin dependencias externas.
 */
export function Celebration({
  trigger,
  title,
  description,
  points,
  onClose,
  accentGradient = "from-amber-400 to-amber-600",
}: CelebrationProps) {
  // Generar piezas de confeti
  const confettiPieces = React.useMemo(() => {
    const colors = ["#10b981", "#0ea5e9", "#f59e0b", "#8b5cf6", "#f43f5e", "#ec4899"];
    return Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.3,
      duration: 1.5 + Math.random() * 1.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      size: 6 + Math.random() * 8,
    }));
  }, [trigger]);

  React.useEffect(() => {
    if (trigger) {
      const timer = setTimeout(() => onClose(), 6000);
      return () => clearTimeout(timer);
    }
  }, [trigger, onClose]);

  return (
    <AnimatePresence>
      {trigger && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Confeti */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {confettiPieces.map((piece) => (
              <motion.div
                key={piece.id}
                initial={{
                  x: `${piece.x}vw`,
                  y: "-10vh",
                  opacity: 1,
                  rotate: 0,
                }}
                animate={{
                  y: "110vh",
                  opacity: [1, 1, 0.8, 0],
                  rotate: piece.rotation,
                }}
                transition={{
                  duration: piece.duration,
                  delay: piece.delay,
                  ease: "easeIn",
                  times: [0, 0.7, 0.9, 1],
                }}
                className="absolute"
                style={{
                  width: piece.size,
                  height: piece.size * 0.4,
                  backgroundColor: piece.color,
                  borderRadius: 2,
                }}
              />
            ))}
          </div>

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", damping: 18, stiffness: 300 }}
            className="relative z-10 w-full max-w-sm overflow-hidden rounded-3xl bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header con gradiente */}
            <div className={`relative bg-gradient-to-br ${accentGradient} p-6 text-center text-white`}>
              <button
                onClick={onClose}
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: "spring", damping: 12 }}
                className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur"
              >
                <CheckCircle2 className="h-9 w-9" />
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-xl font-bold"
              >
                {title}
              </motion.h2>
              {description && (
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="mt-1 text-sm text-white/90"
                >
                  {description}
                </motion.p>
              )}
            </div>

            {/* Body */}
            <div className="space-y-4 p-6 text-center">
              {points != null && points > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5, type: "spring", damping: 14 }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-4 py-1.5 text-sm font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                >
                  <Sparkles className="h-4 w-4" />
                  +{points} puntos
                </motion.div>
              )}
              <p className="text-sm text-muted-foreground">
                ¡Sigue así! Cada actividad te acerca a dominar Electromedicina II.
              </p>
              <Button onClick={onClose} className="w-full">
                ¡Genial!
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
