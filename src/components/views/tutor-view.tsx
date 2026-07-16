"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown, { type Components } from "react-markdown";
import {
  Send,
  Bot,
  User,
  Sparkles,
  Star,
  RefreshCw,
  Lightbulb,
  MessageSquare,
  BookOpen,
  ShieldCheck,
  Clock,
} from "lucide-react";

import { useAppStore } from "@/store/app-store";
import { useFetch, postJSON, patchJSON } from "@/hooks/use-fetch";
import { useToast } from "@/hooks/use-toast";
import { DynamicIcon } from "@/components/app/dynamic-icon";
import { PageHeader } from "@/components/app/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getUnitColor, initials } from "@/lib/course-utils";
import type { ChatMessage, Unit, User as AppUser } from "@/lib/types";

// ---------------------------------------------------------------------------
// Datos estáticos
// ---------------------------------------------------------------------------

const SUGGESTED_PROMPTS: { icon: string; text: string }[] = [
  {
    icon: "Activity",
    text: "¿Cómo funciona el triángulo de Einthoven y por qué basta con 3 derivaciones?",
  },
  {
    icon: "Zap",
    text: "Explícame la polarización de electrodos Ag/AgCl y por qué se prefiere este material.",
  },
  {
    icon: "ShieldCheck",
    text: "¿Qué es la corriente de fuga en un equipo médico y cómo la limita el aislamiento?",
  },
  {
    icon: "HeartPulse",
    text: "¿Por qué un marcapasos usa pulsos bipolares en lugar de unipolares?",
  },
  {
    icon: "MonitorHeart",
    text: "¿Cómo mide la presión arterial el método oscilométrico?",
  },
  {
    icon: "Lightbulb",
    text: "¿Qué diferencia hay entre el ruido de 60 Hz y la deriva de la línea base?",
  },
];

const EMPTY_STATE_PROMPTS = SUGGESTED_PROMPTS.slice(0, 3);

// Estilos para el markdown que devuelve el tutor
const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }) => (
    <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  h1: ({ children }) => <h3 className="mb-2 text-base font-semibold last:mb-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mb-2 text-base font-semibold last:mb-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mb-1 text-sm font-semibold last:mb-0">{children}</h4>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ children }) => (
    <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.85em] text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="mb-2 overflow-x-auto rounded-lg bg-amber-950/10 p-2 text-xs last:mb-0 dark:bg-amber-950/40">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-amber-400 pl-3 italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="underline decoration-amber-400/50 underline-offset-2 hover:text-amber-700 dark:hover:text-amber-300"
    >
      {children}
    </a>
  ),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (rating: number) => void;
}) {
  const [hover, setHover] = useState(0);
  const display = hover || value;
  return (
    <div
      className="flex items-center gap-0.5"
      role="group"
      aria-label="Calificar respuesta"
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const active = display >= n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(0)}
            aria-label={`${n} estrella${n > 1 ? "s" : ""}${
              value === n ? " (seleccionada)" : ""
            }`}
            className="rounded p-0.5 transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <Star
              className={cn(
                "h-3.5 w-3.5 transition-colors",
                active
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground/40 hover:text-amber-300"
              )}
            />
          </button>
        );
      })}
      {value > 0 && (
        <span className="ml-1 text-xs font-medium text-muted-foreground">
          {value}/5
        </span>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-md">
        <Bot className="h-4 w-4" />
      </div>
      <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-3">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-2 w-2 rounded-full bg-amber-400"
              animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
              transition={{
                duration: 0.9,
                repeat: Infinity,
                delay: i * 0.15,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  userName,
  onRate,
}: {
  message: ChatMessage;
  userName: string;
  onRate: (id: string, rating: number) => void;
}) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn(
        "flex items-end gap-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      {isUser ? (
        <Avatar className="h-9 w-9 border-0">
          <AvatarFallback className="bg-gradient-to-br from-[#003366] to-[#0066AA] text-white">
            {initials(userName) || <User className="h-4 w-4" />}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-md">
          <Bot className="h-4 w-4" />
        </div>
      )}

      {/* Burbuja */}
      <div
        className={cn(
          "flex max-w-[78%] flex-col gap-1.5 sm:max-w-[75%]",
          isUser ? "items-end" : "items-start"
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm shadow-sm",
            isUser
              ? "rounded-br-md bg-gradient-to-br from-[#003366] to-[#0066AA] text-white"
              : "rounded-bl-md bg-muted text-foreground"
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
          ) : (
            <div className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              <ReactMarkdown components={markdownComponents}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Meta: timestamp, contexto, rating */}
        <div
          className={cn(
            "flex items-center gap-2 text-xs text-muted-foreground",
            isUser ? "flex-row-reverse" : "flex-row"
          )}
        >
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatTimestamp(message.createdAt)}
          </span>
          {isUser && message.context && (
            <Badge
              variant="secondary"
              className="gap-1 px-1.5 py-0 text-xs font-normal"
            >
              <BookOpen className="h-2.5 w-2.5" />
              {message.context}
            </Badge>
          )}
          {!isUser && (
            <StarRating
              value={message.rating ?? 0}
              onChange={(r) => onRate(message.id, r)}
            />
          )}
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-5 px-4 py-10 text-center"
    >
      <div className="relative">
        <div className="absolute inset-0 -z-10 rounded-full bg-amber-400/30 blur-2xl" />
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg">
          <Sparkles className="h-8 w-8" />
        </div>
      </div>
      <div className="space-y-1.5">
        <h3 className="text-lg font-semibold">
          Hola, soy tu Tutor IA 🎓
        </h3>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          Te guiaré con preguntas para que construyas tu propio conocimiento.
          No te daré las respuestas directas, pero caminaremos juntos hacia
          ellas. Empieza con una de estas consultas o escribe la tuya:
        </p>
      </div>
      <div className="grid w-full max-w-2xl gap-2 sm:grid-cols-3">
        {EMPTY_STATE_PROMPTS.map((p) => (
          <button
            key={p.text}
            type="button"
            onClick={() => onPick(p.text)}
            className="group flex h-full flex-col items-start gap-2 rounded-xl border bg-card p-3 text-left text-xs transition hover:border-amber-300 hover:bg-amber-50/50 hover:shadow-md dark:hover:border-amber-700 dark:hover:bg-amber-950/30"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-600 transition group-hover:scale-110 dark:bg-amber-950/60 dark:text-amber-300">
              <DynamicIcon name={p.icon} className="h-3.5 w-3.5" />
            </span>
            <span className="leading-snug text-foreground/80">{p.text}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function TutorView() {
  const currentUser = useAppStore((s) => s.currentUser) as AppUser | null;
  const tutorContextUnit = useAppStore((s) => s.tutorContextUnit);
  const setTutorContext = useAppStore((s) => s.setTutorContext);
  const { toast } = useToast();

  const userId = currentUser?.id ?? "";

  // Cargar unidades para el selector de contexto
  const { data: unitsData, loading: unitsLoading } = useFetch<{ units: Unit[] }>(
    userId ? `/api/units?userId=${userId}` : null,
    [userId]
  );

  // Cargar historial del chat
  const {
    data: historyData,
    loading: historyLoading,
    refetch: refetchHistory,
  } = useFetch<{ messages: ChatMessage[] }>(
    userId ? `/api/tutor?userId=${userId}` : null,
    [userId]
  );

  const units = useMemo(() => unitsData?.units ?? [], [unitsData]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [ratedIds, setRatedIds] = useState<Set<string>>(new Set());

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sincronizar historial cargado con el estado local
  useEffect(() => {
    if (historyData?.messages) {
      setMessages(historyData.messages);
    }
  }, [historyData]);

  // Auto-scroll al final cuando llegan mensajes nuevos o mientras se envía
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isSending]);

  const selectedContext = tutorContextUnit ?? null;

  const handleSelectContext = (unitTitle: string | null) => {
    setTutorContext(unitTitle);
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending || !userId) return;

    const userMessage: ChatMessage = {
      id: `temp-user-${Date.now()}`,
      userId,
      role: "user",
      content: trimmed,
      context: selectedContext,
      rating: null,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);

    try {
      const res = await postJSON<{
        message: { id: string; role: "assistant"; content: string; createdAt: string };
      }>("/api/tutor", {
        userId,
        message: trimmed,
        context: selectedContext ?? undefined,
      });

      const assistantMessage: ChatMessage = {
        id: res.message.id,
        userId,
        role: "assistant",
        content: res.message.content,
        context: selectedContext,
        rating: null,
        createdAt: res.message.createdAt,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo enviar el mensaje";
      toast({
        title: "Error de conexión",
        description: msg,
        variant: "destructive",
      });
      // Reinsertar el texto del usuario para que no se pierda
      setInput(trimmed);
      // Remover el mensaje optimista fallido
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
    } finally {
      setIsSending(false);
      // Devolver foco al textarea
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleRate = async (messageId: string, rating: number) => {
    // Actualización optimista local
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, rating } : m))
    );

    const isFirstRating = !ratedIds.has(messageId);
    setRatedIds((prev) => new Set(prev).add(messageId));

    try {
      await patchJSON<{ ok: true }>("/api/tutor", { messageId, rating });
      if (isFirstRating) {
        toast({
          title: "Gracias por tu feedback ⭐",
          description: "Tu valoración nos ayuda a mejorar la tutoría.",
        });
      }
    } catch {
      // Revertir en caso de error
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, rating: null } : m))
      );
      setRatedIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
      toast({
        title: "No se pudo guardar la calificación",
        description: "Inténtalo nuevamente en unos segundos.",
        variant: "destructive",
      });
    }
  };

  const handleRefresh = () => {
    if (isSending) return;
    refetchHistory();
    toast({
      title: "Conversación actualizada",
      description: "Se ha recargado el historial desde el servidor.",
    });
  };

  const userName = currentUser?.name ?? "Estudiante";
  const hasMessages = messages.length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 lg:p-8">
      <PageHeader
        title="Tutor IA"
        icon="MessageSquare"
        iconGradient="from-amber-400 to-amber-600"
        description="Tu asistente pedagógico. Te guía sin darte las respuestas — construye tu propio conocimiento."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isSending || historyLoading}
            className="gap-1.5"
          >
            <RefreshCw
              className={cn("h-4 w-4", historyLoading && "animate-spin")}
            />
            <span className="hidden sm:inline">Regenerar</span>
          </Button>
        }
      />

      {/* Selector de contexto + disclaimer */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-amber-500" />
            ¿Sobre qué unidad quieres conversar?
          </CardTitle>
          <CardDescription>
            Elige un tema para que el tutor ajuste sus preguntas. Puedes cambiar
            en cualquier momento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Chips de unidades */}
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {/* Opción General */}
            <button
              type="button"
              onClick={() => handleSelectContext(null)}
              aria-pressed={selectedContext === null}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
                selectedContext === null
                  ? "border-transparent bg-gradient-to-br from-slate-600 to-slate-700 text-white shadow-md"
                  : "border-border bg-card text-foreground/80 hover:border-amber-300 hover:bg-amber-50/50 dark:hover:border-amber-700 dark:hover:bg-amber-950/30"
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              General
            </button>

            {unitsLoading &&
              units.length === 0 &&
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={`skeleton-${i}`} className="h-8 w-32 shrink-0 rounded-full" />
              ))}

            {units.map((u) => {
              const color = getUnitColor(u.color);
              const isSelected = selectedContext === u.title;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleSelectContext(u.title)}
                  aria-pressed={isSelected}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
                    isSelected
                      ? cn(
                          "border-transparent bg-gradient-to-br text-white shadow-md",
                          color.gradient
                        )
                      : cn(
                          "border-border bg-card text-foreground/80 hover:border-amber-300 hover:bg-amber-50/50 dark:hover:border-amber-700 dark:hover:bg-amber-950/30"
                        )
                  )}
                >
                  <DynamicIcon name={u.icon} className="h-3.5 w-3.5" />
                  <span className="max-w-[180px] truncate">{u.title}</span>
                </button>
              );
            })}
          </div>

          {/* Disclaimer socrático */}
          <div className="flex items-start gap-3 rounded-xl border border-amber-200/60 bg-amber-50/60 p-3 text-sm dark:border-amber-900/60 dark:bg-amber-950/30">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300">
              <Lightbulb className="h-3.5 w-3.5" />
            </span>
            <p className="text-[#003366]/80 dark:text-amber-100/80">
              <strong className="font-semibold">Método socrático:</strong> el
              tutor te hará preguntas para que llegues a la respuesta por ti
              mismo. No te dará la solución directa, pero te acompañará paso a
              paso.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Sugerencias (siempre visibles) */}
      <Card className="py-4">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Sugerencias para empezar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-3 lg:overflow-visible">
            {SUGGESTED_PROMPTS.map((p) => (
              <button
                key={p.text}
                type="button"
                onClick={() => {
                  setInput(p.text);
                  requestAnimationFrame(() => textareaRef.current?.focus());
                }}
                className="group flex shrink-0 items-start gap-2 rounded-lg border bg-card p-2.5 text-left text-xs transition hover:border-amber-300 hover:bg-amber-50/50 hover:shadow-sm dark:hover:border-amber-700 dark:hover:bg-amber-950/30 lg:shrink"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-600 transition group-hover:scale-110 dark:bg-amber-950/60 dark:text-amber-300">
                  <DynamicIcon name={p.icon} className="h-3 w-3" />
                </span>
                <span className="leading-snug text-foreground/80">{p.text}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Conversación */}
      <Card className="overflow-hidden py-0">
        <CardHeader className="border-b bg-muted/30 py-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Bot className="h-4 w-4 text-amber-500" />
              Conversación
              {selectedContext && (
                <Badge
                  variant="secondary"
                  className="ml-1 gap-1 bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                >
                  <BookOpen className="h-3 w-3" />
                  {selectedContext}
                </Badge>
              )}
            </CardTitle>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3 w-3" />
              {messages.length} mensaje{messages.length === 1 ? "" : "s"}
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <ScrollArea className="h-[55vh] min-h-[400px] max-h-[600px]">
            <div className="flex flex-col gap-5 p-4 sm:p-6">
              {historyLoading && messages.length === 0 ? (
                <div className="space-y-5">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex gap-3",
                        i % 2 === 1 ? "flex-row-reverse" : "flex-row"
                      )}
                    >
                      <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-16 w-64 rounded-2xl" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : !hasMessages ? (
                <EmptyState
                  onPick={(text) => {
                    setInput(text);
                    requestAnimationFrame(() => textareaRef.current?.focus());
                  }}
                />
              ) : (
                <AnimatePresence initial={false}>
                  {messages.map((m) => (
                    <MessageBubble
                      key={m.id}
                      message={m}
                      userName={userName}
                      onRate={handleRate}
                    />
                  ))}
                </AnimatePresence>
              )}

              {isSending && (
                <div className="pt-1">
                  <TypingIndicator />
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Área de entrada */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="space-y-2"
      >
        <div className="relative rounded-2xl border bg-card shadow-sm focus-within:border-amber-300 focus-within:ring-2 focus-within:ring-amber-400/30 dark:focus-within:border-amber-700">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Escribe tu consulta… (Enter para enviar, Shift+Enter para salto de línea)"
            disabled={isSending}
            className="min-h-[60px] resize-none border-0 bg-transparent pr-14 shadow-none focus-visible:ring-0 focus-visible:border-0"
            aria-label="Mensaje al tutor"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isSending}
            className="absolute bottom-2.5 right-2.5 h-9 w-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-md transition hover:opacity-90 disabled:opacity-40"
            aria-label="Enviar mensaje"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="flex items-center justify-between px-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-amber-400" />
            El tutor responde con el método socrático.
          </span>
          <span className="hidden sm:inline">
            <kbd className="rounded border bg-muted px-1 py-0.5 text-xs font-mono">
              Enter
            </kbd>{" "}
            enviar ·{" "}
            <kbd className="rounded border bg-muted px-1 py-0.5 text-xs font-mono">
              Shift+Enter
            </kbd>{" "}
            salto
          </span>
        </p>
      </form>
    </div>
  );
}
