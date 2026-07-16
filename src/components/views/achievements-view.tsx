"use client";

import { motion } from "framer-motion";
import { useAppStore } from "@/store/app-store";
import { useFetch } from "@/hooks/use-fetch";
import { PageHeader } from "@/components/app/page-header";
import { LoadingGrid, LoadingRows } from "@/components/app/loading";
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

const tierGradient: Record<BadgeWithStatus["tier"], string> = {
  bronze: "from-amber-500 to-orange-700",
  silver: "from-slate-400 to-slate-600",
  gold: "from-yellow-400 to-amber-600",
};

const tierLabel: Record<BadgeWithStatus["tier"], string> = {
  bronze: "Bronce",
  silver: "Plata",
  gold: "Oro",
};

const kpiTheme: Record<string, { icon: string; gradient: string }> = {
  points: {
    icon: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
    gradient: "from-amber-500 to-orange-600",
  },
  streak: {
    icon: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
    gradient: "from-amber-400 to-amber-600",
  },
  badges: {
    icon: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
    gradient: "from-amber-400 to-amber-600",
  },
};

// ---------- Main component ----------

export function AchievementsView() {
  const currentUser = useAppStore((s) => s.currentUser) as User | null;

  const userId = currentUser?.id ?? "";
  const { data: badgesData, loading: badgesLoading } = useFetch<BadgesResponse>(
    `/api/badges?userId=${userId}`,
    [userId]
  );
  const { data: progressData } = useFetch<BadgeProgressResponse>(
    userId ? `/api/badge-progress?userId=${userId}` : null,
    [userId]
  );
  const { data: leaderboardData, loading: leaderboardLoading } =
    useFetch<LeaderboardResponse>(`/api/leaderboard`, []);

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
        iconGradient="from-amber-500 to-orange-600"
        description="Tu progreso, insignias y posición en el curso."
      />

      {/* ---------- Section 1: Tu resumen ---------- */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          icon={<Sparkles className="h-5 w-5" />}
          label="Puntos totales"
          value={points.toLocaleString("es-CL")}
          sub="Acumulados en el piloto"
          theme={kpiTheme.points}
        />
        <KpiCard
          icon={<Flame className="h-5 w-5" />}
          label="Días de racha"
          value={`${streak}`}
          sub={streak > 0 ? "¡Sigue así!" : "Comienza hoy"}
          theme={kpiTheme.streak}
        />
        <KpiCard
          icon={<Trophy className="h-5 w-5" />}
          label="Insignias obtenidas"
          value={`${earnedCount}/${totalBadges}`}
          sub={`${totalBadges > 0 ? Math.round((earnedCount / totalBadges) * 100) : 0}% del total`}
          theme={kpiTheme.badges}
        />
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
            {earnedCount} de {totalBadges}
          </Badge>
        </div>

        {badgesLoading ? (
          <LoadingGrid count={6} />
        ) : badges.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950">
                <Trophy className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-sm text-muted-foreground">
                Aún no se han configurado insignias para este curso.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {badges.map((badge, i) => (
              <BadgeCard key={badge.id} badge={badge} index={i} progress={progressMap[badge.id]} />
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
            {leaderboard.length} participantes
          </Badge>
        </div>

        {leaderboardLoading ? (
          <Card>
            <CardContent className="pt-0">
              <LoadingRows count={5} />
            </CardContent>
          </Card>
        ) : leaderboard.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Crown className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                El ranking aún no está disponible.
              </p>
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
                  const isCurrentUser = entry.id === userId;
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
  sub,
  theme,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  theme: { icon: string; gradient: string };
}) {
  return (
    <Card className="relative overflow-hidden">
      <div
        className={cn(
          "absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br opacity-10 blur-2xl",
          theme.gradient
        )}
      />
      <CardContent className="relative flex items-center gap-4">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
            theme.icon
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-3xl font-bold tabular-nums">{value}</div>
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function BadgeCard({
  badge,
  index,
  progress,
}: {
  badge: BadgeWithStatus;
  index: number;
  progress?: BadgeProgressItem;
}) {
  const tier = badgeTierMeta[badge.tier] ?? badgeTierMeta.bronze;
  const gradient = tierGradient[badge.tier] ?? tierGradient.bronze;
  const showProgress = !badge.earned && progress && progress.target > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.3) }}
      whileHover={{ y: -4 }}
    >
      <Card
        className={cn(
          "relative h-full overflow-hidden transition-shadow",
          badge.earned
            ? cn("shadow-md hover:shadow-lg", tier.glow)
            : "opacity-90"
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
                  "flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg",
                  gradient,
                  !badge.earned && "grayscale opacity-50"
                )}
              >
                <DynamicIcon name={badge.icon} className="h-7 w-7" />
              </div>
              {badge.earned ? (
                <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-[#003366] text-white shadow-sm">
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

          <div className="flex items-center justify-between text-[11px]">
            {badge.earned ? (
              <>
                <span className="inline-flex items-center gap-1 font-medium text-[#003366] dark:text-amber-400">
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
                    {progress!.pct >= 100 ? "¡Listo para desbloquear!" : "En progreso"}
                  </span>
                  <span className="font-semibold tabular-nums text-muted-foreground">
                    {progress!.current}/{progress!.target}
                  </span>
                </div>
                <Progress
                  value={progress!.pct}
                  className="h-2 bg-muted/50 [&_[data-slot=progress-indicator]]:bg-amber-500"
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
                  className="text-[10px] text-muted-foreground"
                >
                  Por desbloquear
                </Badge>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
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
        isCurrentUser &&
          "bg-[#003366]/5/80 dark:bg-[#003366]/20/30"
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
          <span className="text-sm font-semibold text-muted-foreground">
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
              ? "bg-[#003366]/10 text-[#003366] dark:bg-[#003366]/20 dark:text-amber-400"
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
            <Badge className="bg-[#003366] text-white">Tú</Badge>
          )}
        </div>
        <p className="truncate text-[11px] text-muted-foreground">
          {entry.completedActivities} actividades completadas
        </p>
      </div>

      {/* Streak */}
      <div className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
        <Flame className="h-3.5 w-3.5 text-amber-500" />
        <span className="font-medium text-foreground">{entry.streak}</span>
        <span className="hidden md:inline">días</span>
      </div>

      {/* Points */}
      <div className="flex shrink-0 flex-col items-end">
        <span
          className={cn(
            "text-sm font-bold tabular-nums",
            isCurrentUser
              ? "text-[#003366] dark:text-amber-400"
              : "text-foreground"
          )}
        >
          {entry.points.toLocaleString("es-CL")}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          pts
        </span>
      </div>
    </li>
  );
}

function rankMedal(rank: number):
  | { Icon: typeof Crown; gradient: string }
  | null {
  switch (rank) {
    case 1:
      return { Icon: Crown, gradient: "from-yellow-400 to-amber-600" };
    case 2:
      return { Icon: Medal, gradient: "from-amber-300 to-amber-500" };
    case 3:
      return { Icon: Award, gradient: "from-amber-600 to-orange-800" };
    default:
      return null;
  }
}
