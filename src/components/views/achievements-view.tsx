"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/app-store";
import { useFetch } from "@/hooks/use-fetch";
import { PageHeader } from "@/components/app/page-header";
import { LoadingGrid, LoadingRows, FetchError } from "@/components/app/loading";
import { DynamicIcon } from "@/components/app/dynamic-icon";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { badgeTierMeta, initials, timeAgo } from "@/lib/course-utils";
import { cn } from "@/lib/utils";
import {
  Trophy,
  Flame,
  Sparkles,
  Lock,
  CheckCircle2,
  Crown,
  Medal,
  Award,
  Target,
} from "lucide-react";
import type { User } from "@/lib/types";

// ---------- Types ----------

interface BadgeWithStatus {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  tier: "bronze" | "silver" | "gold";
  earned: boolean;
  awardedAt: string | null;
}

interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  email: string;
  points: number;
  streak: number;
  avatar: string | null;
  completedActivities: number;
}

interface BadgesResponse {
  badges: BadgeWithStatus[];
}

interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
}

interface BadgeProgressItem {
  badgeId: string;
  slug: string;
  current: number;
  target: number;
  pct: number;
  unitContext: string | null;
}

interface BadgeProgressResponse {
  badges: BadgeProgressItem[];
}

// ---------- Visual config ----------

// Gradientes de tier: el dorado de oro es el dorado de marca (token).
const tierGradient: Record<BadgeWithStatus["tier"], string> = {
  bronze: "from-amber-500 to-orange-700",
  silver: "from-slate-400 to-slate-600",
  gold: "from-brand-gold to-amber-600",
};

const tierLabel: Record<BadgeWithStatus["tier"], string> = {
  bronze: "Bronce",
  silver: "Plata",
  gold: "Oro",
};

// Verde monitor (chart-3) solo para datos de éxito/progreso. La variante
// oscura en claro mantiene contraste ≥4.5:1 sobre porcelana.
const successText = "text-[oklch(0.45_0.13_165)] dark:text-chart-3";
const successChip =
  "bg-chart-3/15 text-[oklch(0.45_0.13_165)] dark:bg-chart-3/20 dark:text-chart-3";

// Tonos de acento para las tarjetas KPI
const kpiTones: Record<string, string> = {
  gold: "bg-accent text-accent-foreground",
  success: successChip,
};

// ---------- Motion helpers (CSS + tokens, sin librerías nuevas) ----------

// Conteo de entrada suave para métricas: el momento focal de la vista.
// Respeta prefers-reduced-motion mostrando el valor final de inmediato.
function useCountUp(target: number, duration = 600): number {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Salto directo al valor final, diferido un frame para no llamar
      // setState sincrónicamente en el cuerpo del effect.
      const id = requestAnimationFrame(() => setDisplay(target));
      return () => cancelAnimationFrame(id);
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      // ease-out exponencial, en la línea de --ease-out-expo
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setDisplay(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return display;
}

// Barra de progreso con llenado animado al montar: parte de 0 y la
// transición del indicador (ui/progress) la lleva a su valor real.
function AnimatedProgress({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return <Progress value={mounted ? value : 0} className={className} />;
}

// ---------- Main component ----------

export function AchievementsView() {
  const currentUser = useAppStore((s) => s.currentUser) as User | null;

  const { data: badgesData, loading: badgesLoading, error: badgesError, refetch: refetchBadges } = useFetch<BadgesResponse>(
    `/api/badges`,
    []
  );
  const { data: progressData } = useFetch<BadgeProgressResponse>(
    `/api/badge-progress`,
    []
  );
  const { data: leaderboardData, loading: leaderboardLoading, error: leaderboardError, refetch: refetchLeaderboard } =
    useFetch<LeaderboardResponse>(`/api/leaderboard`, []);

  if (badgesError || leaderboardError) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-8">
        <PageHeader
          title="Logros y ranking"
          icon="Trophy"
          description="Tu progreso, insignias y posición en el curso."
        />
        <FetchError
          description={badgesError ?? leaderboardError ?? undefined}
          onRetry={() => {
            refetchBadges();
            refetchLeaderboard();
          }}
        />
      </div>
    );
  }

  const badges = badgesData?.badges ?? [];
  const earnedBadges = badges.filter((b) => b.earned);
  const leaderboard = leaderboardData?.leaderboard ?? [];

  // Map badge progress by badgeId
  const progressMap: Record<string, BadgeProgressItem> = {};
  for (const p of progressData?.badges ?? []) {
    progressMap[p.badgeId] = p;
  }

  const points = currentUser?.points ?? 0;
  const streak = currentUser?.streak ?? 0;
  const totalBadges = badges.length;
  const earnedCount = earnedBadges.length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-8">
      <PageHeader
        title="Logros y ranking"
        icon="Trophy"
        description="Tu progreso, insignias y posición en el curso."
      />

      {/* ---------- Section 1: Tu resumen ---------- */}
      <section className="stagger-children grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-full">
          <KpiCard
            icon={<Sparkles className="h-5 w-5" />}
            label="Puntos totales"
            value={points}
            sub="Acumulados en el piloto"
            tone={kpiTones.gold}
          />
        </div>
        <div className="h-full">
          <KpiCard
            icon={<Flame className="h-5 w-5" />}
            label="Días de racha"
            value={streak}
            sub={streak > 0 ? "¡Sigue así!" : "Comienza hoy"}
            tone={kpiTones.gold}
          />
        </div>
        <div className="h-full">
          <KpiCard
            icon={<Trophy className="h-5 w-5" />}
            label="Insignias obtenidas"
            value={earnedCount}
            format={(n) => `${n}/${totalBadges}`}
            sub={`${totalBadges > 0 ? Math.round((earnedCount / totalBadges) * 100) : 0}% del total`}
            tone={kpiTones.success}
          />
        </div>
      </section>

      {/* ---------- Section 2: Insignias ---------- */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Insignias</h2>
            <p className="text-sm text-muted-foreground">
              Desbloquéalas a medida que avanzas en el curso.
            </p>
          </div>
          <Badge variant="outline" className="gap-1">
            <Trophy className="h-3 w-3" />
            <span className="font-mono tabular-nums">
              {earnedCount} de {totalBadges}
            </span>
          </Badge>
        </div>

        {badgesLoading ? (
          <LoadingGrid count={6} />
        ) : badges.length === 0 ? (
          <Card className="animate-fade-in-up">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Trophy className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Aún no hay insignias disponibles</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Cuando el equipo docente configure las insignias del curso,
                  aparecerán aquí con su progreso de desbloqueo.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Cascada en el grid (wrapper), hover-lift en la tarjeta */
          <div className="stagger-children grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {badges.map((badge) => (
              <div key={badge.id} className="h-full">
                <BadgeCard badge={badge} progress={progressMap[badge.id]} />
              </div>
            ))}
          </div>
        )}
      </section>

      <Separator className="my-2" />

      {/* ---------- Section 3: Ranking del curso ---------- */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Ranking del curso</h2>
            <p className="text-sm text-muted-foreground">
              Posición de tus compañeras y compañeros en el piloto.
            </p>
          </div>
          <Badge variant="outline" className="gap-1">
            <Crown className="h-3 w-3" />
            <span className="font-mono tabular-nums">{leaderboard.length}</span>
            participantes
          </Badge>
        </div>

        {leaderboardLoading ? (
          <Card>
            <CardContent className="pt-0">
              <LoadingRows count={5} />
            </CardContent>
          </Card>
        ) : leaderboard.length === 0 ? (
          <Card className="animate-fade-in-up">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Crown className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">El ranking aún no está disponible</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Se activará cuando las y los participantes del piloto empiecen
                  a acumular puntos.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Clasificación general</CardTitle>
              <CardDescription>
                Ordenado por puntos acumulados en el piloto de Electromedicina II.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ol className="divide-y divide-border">
                {leaderboard.map((entry) => {
                  const isCurrentUser = entry.id === currentUser?.id;
                  return (
                    <LeaderboardRow
                      key={entry.id}
                      entry={entry}
                      isCurrentUser={isCurrentUser}
                    />
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

// ---------- Sub-components ----------

function KpiCard({
  icon,
  label,
  value,
  format,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  format?: (n: number) => string;
  sub: string;
  tone: string;
}) {
  const display = useCountUp(value);
  return (
    <Card className="hover-lift h-full overflow-hidden">
      <CardContent className="flex items-center gap-4">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
            tone
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="font-mono text-3xl font-semibold tabular-nums">
            {format ? format(display) : display.toLocaleString("es-CL")}
          </div>
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function BadgeCard({
  badge,
  progress,
}: {
  badge: BadgeWithStatus;
  progress?: BadgeProgressItem;
}) {
  const tier = badgeTierMeta[badge.tier] ?? badgeTierMeta.bronze;
  const gradient = tierGradient[badge.tier] ?? tierGradient.bronze;
  const showProgress = !badge.earned && progress && progress.target > 0;

  return (
    <Card
      className={cn(
        "hover-lift relative h-full overflow-hidden shadow-sm",
        !badge.earned && "opacity-90"
      )}
    >
      {badge.earned && (
        <div
          className={cn(
            "absolute inset-x-0 top-0 h-1 bg-gradient-to-r",
            gradient
          )}
        />
      )}
      <CardContent className="flex h-full flex-col gap-3 pt-6">
        <div className="flex items-start justify-between">
          <div className="relative">
            <div
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md",
                gradient,
                !badge.earned && "grayscale opacity-50"
              )}
            >
              <DynamicIcon name={badge.icon} className="h-7 w-7" />
            </div>
            {badge.earned ? (
              <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-brand text-white shadow-sm">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
            ) : (
              <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-muted text-muted-foreground shadow-sm">
                <Lock className="h-3 w-3" />
              </div>
            )}
          </div>
          <Badge
            variant="outline"
            className={cn(
              "gap-1 border px-2.5 py-1 text-xs",
              badge.earned
                ? cn(tier.bg, tier.color, tier.border)
                : "text-muted-foreground"
            )}
          >
            {badge.earned ? (
              <Award className="h-3 w-3" />
            ) : (
              <Lock className="h-3 w-3" />
            )}
            {tierLabel[badge.tier]}
          </Badge>
        </div>

        <div className="space-y-1">
          <h3
            className={cn(
              "font-semibold leading-tight",
              !badge.earned && "text-muted-foreground"
            )}
          >
            {badge.name}
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {badge.description}
          </p>
        </div>

        <Separator className="my-auto" />

        <div className="flex items-center justify-between text-xs">
          {badge.earned ? (
            <>
              <span className={cn("inline-flex items-center gap-1 font-medium", successText)}>
                <CheckCircle2 className="h-3 w-3" />
                Desbloqueada
              </span>
              <span className="text-muted-foreground">
                {badge.awardedAt ? timeAgo(badge.awardedAt) : "—"}
              </span>
            </>
          ) : showProgress ? (
            <div className="w-full space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Target className="h-3 w-3" />
                  {progress!.pct >= 100 ? "¡Lista para desbloquear!" : "En progreso"}
                </span>
                <span className="font-mono font-semibold tabular-nums text-muted-foreground">
                  {progress!.current}/{progress!.target}
                </span>
              </div>
              <AnimatedProgress
                value={progress!.pct}
                className="h-2 bg-muted/50 [&_[data-slot=progress-indicator]]:bg-brand-gold"
              />
            </div>
          ) : (
            <>
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Target className="h-3 w-3" />
                En progreso
              </span>
              <Badge
                variant="secondary"
                className="text-xs text-muted-foreground"
              >
                Por desbloquear
              </Badge>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LeaderboardRow({
  entry,
  isCurrentUser,
}: {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
}) {
  const medal = rankMedal(entry.rank);
  return (
    <li
      className={cn(
        "flex items-center gap-3 px-4 py-3 transition-colors sm:px-6",
        isCurrentUser && "bg-primary/5 dark:bg-primary/10"
      )}
    >
      {/* Rank / medal */}
      <div className="flex w-9 shrink-0 items-center justify-center">
        {medal ? (
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-sm",
              medal.gradient
            )}
          >
            <medal.Icon className="h-4 w-4" />
          </div>
        ) : (
          <span className="font-mono text-sm font-semibold tabular-nums text-muted-foreground">
            #{entry.rank}
          </span>
        )}
      </div>

      {/* Avatar + name */}
      <Avatar className="h-9 w-9 border">
        <AvatarFallback
          className={cn(
            "text-xs font-medium",
            isCurrentUser
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
          )}
        >
          {initials(entry.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{entry.name}</p>
          {isCurrentUser && (
            <Badge className="bg-brand text-white">Tú</Badge>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          <span className="font-mono tabular-nums">{entry.completedActivities}</span>
          {" "}actividades completadas
        </p>
      </div>

      {/* Streak */}
      <div className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
        <Flame className="h-3.5 w-3.5 text-brand-gold" />
        <span className="font-mono font-medium tabular-nums text-foreground">{entry.streak}</span>
        <span className="hidden md:inline">días</span>
      </div>

      {/* Points */}
      <div className="flex shrink-0 flex-col items-end">
        <span
          className={cn(
            "font-mono text-sm font-semibold tabular-nums",
            isCurrentUser ? "text-primary" : "text-foreground"
          )}
        >
          {entry.points.toLocaleString("es-CL")}
        </span>
        <span className="text-xs text-muted-foreground">pts</span>
      </div>
    </li>
  );
}

function rankMedal(rank: number):
  | { Icon: typeof Crown; gradient: string }
  | null {
  switch (rank) {
    case 1:
      return { Icon: Crown, gradient: "from-brand-gold to-amber-600" };
    case 2:
      return { Icon: Medal, gradient: "from-slate-300 to-slate-500" };
    case 3:
      return { Icon: Award, gradient: "from-amber-600 to-orange-800" };
    default:
      return null;
  }
}
