"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
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
  X,
  Flag,
  CheckCircle2,
} from "lucide-react";

import { useAppStore } from "@/store/app-store";
import { useFetch, postJSON, patchJSON } from "@/hooks/use-fetch";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { initials } from "@/lib/course-utils";
import type { ChatMessage, User as AppUser } from "@/lib/types";

const SUGGESTED_PROMPTS = [
  "¿Cómo funciona el triángulo de Einthoven?",
  "Explícame la polarización de electrodos Ag/AgCl",
  "¿Qué es la corriente de fuga en un equipo médico?",
  "¿Por qué un marcapasos usa pulsos bipolares?",
  "¿Cómo mide la presión el método oscilométrico?",
  "Diferencia entre ruido de 60 Hz y deriva de línea base",
];

const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  h1: ({ children }) => <h3 className="mb-2 text-sm font-semibold last:mb-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mb-2 text-sm font-semibold last:mb-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mb-1 text-xs font-semibold last:mb-0">{children}</h4>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ children }) => (
    <code className="rounded bg-amber-100 px-1 py-0.5 text-xs font-mono text-amber-700 dark:bg-amber-950 dark:text-amber-300">
      {children}
    </code>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-amber-300 pl-3 italic text-muted-foreground">
      {children}
    </blockquote>
  ),
};

export function ChatSidebar() {
  const currentUser = useAppStore((s) => s.currentUser) as AppUser | null;
  const role = useAppStore((s) => s.role);
  const chatOpen = useAppStore((s) => s.chatOpen);
  const setChatOpen = useAppStore((s) => s.setChatOpen);
  const tutorContextUnit = useAppStore((s) => s.tutorContextUnit);
  const userId = currentUser?.id ?? "";

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const { data, loading, refetch } = useFetch<{ messages: ChatMessage[] }>(
    userId ? `/api/tutor?userId=${userId}` : null,
    [userId]
  );

  // Reset mensajes locales cuando cambia el usuario
  useEffect(() => {
    setLocalMessages([]);
  }, [userId]);

  // Combinar mensajes del servidor + locales optimistas
  const allMessages = useMemo(() => {
    const serverMsgs = data?.messages ?? [];
    const localIds = new Set(localMessages.map((m) => m.id));
    const serverOnly = serverMsgs.filter((m) => !localIds.has(m.id));
    return [...serverOnly, ...localMessages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [data?.messages, localMessages]);

  // Auto-scroll al final
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [allMessages.length, sending]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !userId) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const userMsg: ChatMessage = {
      id: `local-${Date.now()}`,
      userId,
      role: "user",
      content: text,
      context: tutorContextUnit,
      rating: null,
      createdAt: new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      const res = await postJSON<{ message: ChatMessage; newBadges?: { badgeName: string; badgeTier: string }[] }>("/api/tutor", {
        userId,
        message: text,
        context: tutorContextUnit ?? undefined,
      });
      // Reemplazar el mensaje del usuario local por el del servidor + añadir respuesta
      setLocalMessages((prev) => [
        ...prev.filter((m) => m.id !== userMsg.id),
        { ...userMsg, id: `srv-${userMsg.id}` },
        res.message,
      ]);
      // Notificar badges desbloqueados
      if (res.newBadges && res.newBadges.length > 0) {
        for (const badge of res.newBadges) {
          toast({
            title: "¡Badge desbloqueado!",
            description: `${badge.badgeName} — ¡Sigue así!`,
          });
        }
      }
      // Refetch para sincronizar IDs reales
      refetch();
    } catch (e) {
      const err = e as Error;
      setLocalMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      toast({
        title: "Error al enviar",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  }, [input, sending, userId, tutorContextUnit, refetch, toast]);

  const handleRate = useCallback(
    async (messageId: string, rating: number) => {
      try {
        await patchJSON("/api/tutor", { messageId, rating });
        setLocalMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, rating } : m))
        );
        toast({ title: "Gracias por tu feedback", description: "Nos ayuda a mejorar al tutor." });
      } catch {
        // silencioso
      }
    },
    [toast]
  );

  const handleReport = useCallback(
    async (messageId: string, reason: string, comment: string) => {
      if (!userId) return;
      try {
        await postJSON("/api/report", {
          userId,
          source: "chat",
          sourceId: messageId,
          reason,
          comment: comment || undefined,
        });
        toast({
          title: "Reporte enviado",
          description: "El equipo docente revisará esta respuesta. ¡Gracias!",
        });
      } catch (e) {
        const err = e as Error;
        toast({
          title: "Error al enviar reporte",
          description: err.message,
          variant: "destructive",
        });
      }
    },
    [userId, toast]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  // No renderizar nada si no es estudiante
  if (role !== "student") return null;

  return (
    <>
      {/* Overlay móvil */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={() => setChatOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Panel lateral derecho */}
      <AnimatePresence>
        {chatOpen && (
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[380px] flex-col border-l border-amber-200 bg-background shadow-2xl dark:border-amber-900"
          >
            {/* Cabecera */}
            <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border bg-gradient-to-r from-[#003366] to-[#004488] px-4 text-white">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="leading-tight">
                  <div className="flex items-center gap-1.5 text-sm font-bold">
                    Tutor IA
                    <Sparkles className="h-3 w-3 text-amber-200" />
                  </div>
                  <div className="text-xs text-white/80">Método socrático · Electromedicina II</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/20 hover:text-white"
                  onClick={() => refetch()}
                  title="Refrescar"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/20 hover:text-white"
                  onClick={() => setChatOpen(false)}
                  title="Cerrar"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Contexto actual */}
            {tutorContextUnit && (
              <div className="shrink-0 border-b border-border bg-amber-50/50 px-4 py-2 dark:bg-amber-950/20">
                <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                  <Lightbulb className="h-3 w-3" />
                  <span className="font-medium">Contexto:</span>
                  <span className="truncate">{tutorContextUnit}</span>
                </div>
              </div>
            )}

            {/* Mensajes */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 [scrollbar-width:thin]">
              {loading ? (
                <div className="space-y-3 px-1">
                  <Skeleton className="h-16 w-3/4 rounded-2xl" />
                  <Skeleton className="ml-auto h-12 w-2/3 rounded-2xl" />
                  <Skeleton className="h-20 w-3/4 rounded-2xl" />
                </div>
              ) : allMessages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg">
                    <MessageSquare className="h-7 w-7" />
                  </div>
                  <h3 className="mb-1 text-sm font-semibold">¡Hola! Soy tu tutor IA</h3>
                  <p className="mb-4 text-xs text-muted-foreground">
                    Te guío con preguntas para que construyas tu propio conocimiento. No te daré la respuesta directa.
                  </p>
                  <div className="w-full space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Sugerencias
                    </p>
                    {SUGGESTED_PROMPTS.slice(0, 4).map((p) => (
                      <button
                        key={p}
                        onClick={() => {
                          setInput(p);
                          textareaRef.current?.focus();
                        }}
                        className="w-full rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-left text-xs text-amber-700 transition hover:border-amber-300 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {allMessages.map((m) => (
                    <ChatBubble
                      key={m.id}
                      message={m}
                      userName={currentUser?.name ?? "Tú"}
                      onRate={(r) => handleRate(m.id, r)}
                      onReport={(reason, comment) => handleReport(m.id, reason, comment)}
                    />
                  ))}
                  {sending && (
                    <div className="flex items-start gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-white">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-muted px-3 py-3">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400 [animation-delay:-0.3s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400 [animation-delay:-0.15s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Input */}
            <div className="shrink-0 border-t border-border bg-card p-3">
              <div className="relative">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    autoResize(e.target);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe tu pregunta..."
                  className="min-h-[44px] resize-none border-amber-200 pr-11 text-sm focus-visible:ring-[#003366] dark:border-amber-900"
                  rows={1}
                  disabled={sending}
                />
                <Button
                  size="icon"
                  className="absolute bottom-1.5 right-1.5 h-8 w-8 rounded-lg bg-amber-500 hover:bg-[#004488]"
                  onClick={handleSend}
                  disabled={!input.trim() || sending}
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="mt-1.5 text-center text-xs text-muted-foreground">
                <kbd className="rounded bg-muted px-1 py-0.5 text-xs">Enter</kbd> enviar ·{" "}
                <kbd className="rounded bg-muted px-1 py-0.5 text-xs">Shift+Enter</kbd> salto
              </p>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

function ChatBubble({
  message,
  userName,
  onRate,
  onReport,
}: {
  message: ChatMessage;
  userName: string;
  onRate: (rating: number) => void;
  onReport: (reason: string, comment: string) => void;
}) {
  const isUser = message.role === "user";
  const [hovered, setHovered] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("incorrect");
  const [reportComment, setReportComment] = useState("");
  const [reported, setReported] = useState(false);

  const reasons = [
    { value: "incorrect", label: "Respuesta incorrecta" },
    { value: "biased", label: "Contenido sesgado" },
    { value: "offtopic", label: "Fuera de tema" },
    { value: "harmful", label: "Contenido inapropiado" },
    { value: "other", label: "Otro" },
  ];

  const submitReport = () => {
    onReport(reportReason, reportComment);
    setReported(true);
    setReportOpen(false);
    setReportComment("");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-start gap-2 ${isUser ? "flex-row-reverse" : ""}`}
    >
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white ${
          isUser
            ? "bg-gradient-to-br from-[#003366] to-[#0066AA]"
            : "bg-gradient-to-br from-amber-400 to-amber-600"
        }`}
      >
        {isUser ? (
          <span className="text-xs font-bold">{initials(userName)}</span>
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>
      <div className={`max-w-[78%] ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-2xl px-3 py-2 text-sm ${
            isUser
              ? "rounded-tr-sm bg-gradient-to-br from-[#003366] to-[#0066AA] text-white"
              : "rounded-tl-sm bg-muted text-foreground"
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-0 prose-ul:my-1 prose-ol:my-1">
              <ReactMarkdown components={markdownComponents}>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>
        <div
          className={`mt-1 flex items-center gap-2 px-1 text-xs text-muted-foreground ${
            isUser ? "justify-end" : "justify-start"
          }`}
        >
          <span>{new Date(message.createdAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</span>
          {!isUser && (
            <>
              <div
                className="flex items-center"
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => onRate(n)}
                    className="p-0.5"
                    title={`${n} estrellas`}
                  >
                    <Star
                      className={`h-3 w-3 transition-colors ${
                        n <= (message.rating ?? 0)
                          ? "fill-amber-400 text-amber-400"
                          : hovered
                          ? "text-amber-300"
                          : "text-muted-foreground/40"
                      }`}
                    />
                  </button>
                ))}
              </div>
              {reported ? (
                <span className="flex items-center gap-0.5 text-[#003366] dark:text-amber-400">
                  <CheckCircle2 className="h-3 w-3" /> Reportado
                </span>
              ) : (
                <button
                  onClick={() => setReportOpen(true)}
                  className="flex items-center gap-0.5 text-muted-foreground/60 transition-colors hover:text-rose-500"
                  title="Reportar error en esta respuesta"
                >
                  <Flag className="h-3 w-3" />
                  <span className="hidden sm:inline">Reportar</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Dialog de reporte */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-4 w-4 text-rose-500" />
              Reportar respuesta del tutor
            </DialogTitle>
            <DialogDescription>
              Tu reporte será revisado por el equipo docente. Esto nos ayuda a mejorar la calidad de la IA.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Motivo del reporte
              </label>
              <div className="space-y-1.5">
                {reasons.map((r) => (
                  <label
                    key={r.value}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm transition-colors ${
                      reportReason === r.value
                        ? "border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={r.value}
                      checked={reportReason === r.value}
                      onChange={(e) => setReportReason(e.target.value)}
                      className="h-3.5 w-3.5 accent-rose-500"
                    />
                    {r.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Comentario (opcional)
              </label>
              <Textarea
                value={reportComment}
                onChange={(e) => setReportComment(e.target.value)}
                placeholder="Describe el problema que encontraste..."
                className="min-h-[70px] resize-none text-sm"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setReportOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={submitReport} className="bg-rose-600 hover:bg-rose-700">
              <Flag className="mr-1 h-3.5 w-3.5" />
              Enviar reporte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
