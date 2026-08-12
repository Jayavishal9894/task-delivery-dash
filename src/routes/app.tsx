import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import {
  Flame,
  Package,
  Plus,
  WifiOff,
  Home,
  History as HistoryIcon,
  Check,
  Rocket,
  Sunrise,
  Sparkles,
  Coffee,
  Utensils,
  UtensilsCrossed,
  Moon,
  Building2,
  LogOut,
  Star,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TaskCard } from "@/components/TaskCard";
import { AddTaskDialog } from "@/components/AddTaskDialog";
import { UrgentOverlay } from "@/components/UrgentOverlay";
import { SettingsDialog } from "@/components/SettingsDialog";
import { HistoryView } from "@/components/HistoryView";
import { useTaskStore, getStreak, todayISO, taskStage } from "@/lib/tasks";
import type { Task, Recurrence, Priority, TriggerType } from "@/lib/tasks";
import { useRoutineConfigs, isEnabledToday } from "@/lib/routineConfig";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const ROUTINE_ICONS = {
  Sunrise, Sparkles, Coffee, Utensils, UtensilsCrossed, Moon, Building2, LogOut, Star,
} as const;

function formatHM(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (isNaN(h)) return hhmm;
  const period = h < 12 ? "AM" : "PM";
  const hr = ((h + 11) % 12) + 1;
  return `${hr}:${String(m).padStart(2, "0")} ${period}`;
}

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Trackit — Your tasks, out for delivery" },
      { name: "description", content: "Track today's tasks like packages." },
    ],
  }),
  component: AppPage,
});

function AppPage() {
  const { tasks, addTask, startTask, completeTask, removeTask, restoreTask, purgeTask, updateTask, fireRoutine, routineFires } =
    useTaskStore();
  const { configs: routineConfigs } = useRoutineConfigs();
  const [streak, setStreak] = useState(0);
  const [online, setOnline] = useState(true);
  const [tab, setTab] = useState<"home" | "history">("home");
  // 1s tick so "missed" state and time-window filter re-evaluate live
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setNowTick((x) => x + 1), 30_000);
    return () => clearInterval(i);
  }, []);
  const [redeliverInit, setRedeliverInit] = useState<{
    name: string;
    time: string;
    recurrence: Recurrence;
    customDays?: number[];
    urgent: boolean;
    priority: Priority;
    trigger: TriggerType;
    routineKey?: string;
    routineLabel?: string;
    routineTime?: string;
  } | null>(null);

  const handleRedeliver = (t: Task) => {
    const due = new Date(t.due);
    const hh = String(due.getHours()).padStart(2, "0");
    const mm = String(due.getMinutes()).padStart(2, "0");
    setRedeliverInit({
      name: t.name,
      time: `${hh}:${mm}`,
      recurrence: t.recurrence,
      customDays: t.customDays,
      urgent: t.urgent,
      priority: t.priority,
      trigger: t.trigger,
      routineKey: t.routineKey,
      routineLabel: t.routineLabel,
      routineTime: t.routineTime,
    });
  };

  useEffect(() => {
    setStreak(getStreak());
    setOnline(navigator.onLine);
    const on = () => {
      setOnline(true);
      toast.success("Back online — all changes saved locally");
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [tasks.length]);

  const today = todayISO();
  const todays = useMemo(
    () => tasks.filter((t) => t.occurrenceDate === today && !t.deletedAt),
    [tasks, today],
  );

  // Compute routine pills from user-configured routines, filtered to the
  // current time window. Each pill carries the matching tasks for the nudge
  // card and state computation.
  type RoutinePill = {
    id: string;
    rid: string; // routineId() for fireRoutine + routineFires
    key?: string;
    label: string;
    icon: keyof typeof ROUTINE_ICONS;
    time: string;
    tasks: Task[];
    pending: number;
    firedAt?: string;
    missed: boolean;
  };
  const pills: RoutinePill[] = useMemo(() => {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const periodOf = (mins: number) => {
      const h = Math.floor(mins / 60);
      if (h < 4) return "night";
      if (h < 12) return "morning";
      if (h < 17) return "afternoon";
      if (h < 22) return "evening";
      return "night";
    };
    const currentPeriod = periodOf(nowMin);
    const out: RoutinePill[] = [];
    for (const c of routineConfigs) {
      if (!isEnabledToday(c)) continue;
      const [h, m] = c.time.split(":").map(Number);
      const rMin = (h ?? 0) * 60 + (m ?? 0);
      const inPeriod = periodOf(rMin) === currentPeriod;
      const rid = c.key ? `k:${c.key}` : `l:${c.label.trim().toLowerCase()}`;
      const firedAt = routineFires[rid];
      const isPast = rMin <= nowMin;
      const missed = isPast && !firedAt && nowMin - rMin > 90;
      // Show pill if: in current period, OR already fired today, OR missed
      if (!inPeriod && !firedAt && !missed) continue;
      const matching = todays.filter(
        (t) =>
          t.trigger === "routine" &&
          ((c.key && t.routineKey === c.key) ||
            (!c.key &&
              t.routineLabel?.trim().toLowerCase() ===
                c.label.trim().toLowerCase())),
      );
      out.push({
        id: c.id,
        rid,
        key: c.key,
        label: c.label,
        icon: (ROUTINE_ICONS[c.icon as keyof typeof ROUTINE_ICONS]
          ? c.icon
          : "Star") as keyof typeof ROUTINE_ICONS,
        time: c.time,
        tasks: matching,
        pending: matching.filter((t) => !t.completedAt && !t.workingAt).length,
        firedAt,
        missed,
      });
    }
    // Sort by routine time
    out.sort((a, b) => a.time.localeCompare(b.time));
    return out;
  }, [routineConfigs, routineFires, todays]);

  // Nudge cards: routines fired in the last 10 minutes show their tasks
  // inline as a quick-glance reminder.
  const nudges = useMemo(
    () =>
      pills.filter(
        (p) =>
          p.firedAt &&
          Date.now() - new Date(p.firedAt).getTime() < 10 * 60 * 1000 &&
          p.tasks.length > 0,
      ),
    [pills],
  );

  const handlePillTap = (p: { rid: string; key?: string; label: string; tasks: Task[] }) => {
    if (p.tasks.length === 0) {
      toast.message(`No tasks for "${p.label}" today`);
      // Still mark fired so it shows as checked-in and won't re-prompt
      fireRoutine(p.key ? { key: p.key } : { label: p.label }, { silent: true });
      return;
    }
    const count = p.key
      ? fireRoutine({ key: p.key })
      : fireRoutine({ label: p.label });
    toast.success(`Done · ${p.label}`, {
      description: `${count} task${count === 1 ? "" : "s"} ready to deliver`,
    });
  };

  const done = todays.filter((t) => taskStage(t) === 3).length;
  const total = todays.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  const sorted = [...todays].sort((a, b) => {
    const ad = taskStage(a) === 3 ? 1 : 0;
    const bd = taskStage(b) === 3 ? 1 : 0;
    if (ad !== bd) return ad - bd;
    return new Date(a.due).getTime() - new Date(b.due).getTime();
  });

  return (
    <div className="min-h-screen bg-muted/30 pb-36">
      <UrgentOverlay tasks={todays} onComplete={completeTask} />

      {!online && (
        <div className="sticky top-0 z-20 bg-amber-500 text-white text-xs font-medium text-center py-1.5 px-3 flex items-center justify-center gap-2">
          <WifiOff className="h-3.5 w-3.5" />
          You're offline — changes are saved on this device and will be there when you're back
        </div>
      )}

      <header className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <Package className="h-4 w-4" />
            </div>
            <span className="font-bold text-lg">Trackit</span>
          </Link>
          <div className="flex items-center gap-3">
            {!online && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <WifiOff className="h-3.5 w-3.5" /> Offline
              </span>
            )}
            <Link
              to="/team"
              className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm font-medium hover:bg-muted/50"
            >
              <Users className="h-4 w-4 text-primary" />
              Team
            </Link>
            <div className="flex items-center gap-1 bg-orange-50 text-orange-600 px-2.5 py-1 rounded-full text-sm font-semibold">
              <Flame className="h-4 w-4" />
              {streak} day streak
            </div>
            <SettingsDialog />
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 pt-5">
        {tab === "history" ? (
          <HistoryView
            tasks={tasks}
            onRedeliver={handleRedeliver}
            onRestore={restoreTask}
            onPurge={purgeTask}
          />
        ) : (
          <>
        <div className="bg-card border rounded-2xl p-4 shadow-sm mb-5">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Today's progress
            </h2>
            <span className="text-sm font-bold text-foreground">
              {done} / {total} delivered
            </span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>

        {pills.length > 0 && (
          <div className="mb-5">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Routine check-in
            </h2>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {pills.map((p) => {
                const Icon = ROUTINE_ICONS[p.icon];
                const short = p.label.replace(/^After |^Before /, "");
                if (p.firedAt) {
                  const t = new Date(p.firedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-500 text-white px-3 py-1.5 text-sm font-medium shadow-sm"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{short}</span>
                      <Check className="h-3.5 w-3.5" />
                      <span className="text-xs opacity-90">{t}</span>
                    </div>
                  );
                }
                if (p.missed) {
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handlePillTap(p)}
                      className="flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-rose-300 bg-rose-50 text-rose-700 px-3 py-1 text-sm font-medium hover:bg-rose-100"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {short} — missed
                    </button>
                  );
                }
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePillTap(p)}
                    className="flex items-center gap-1.5 whitespace-nowrap rounded-full border bg-card px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-muted/50"
                  >
                    <Icon className="h-3.5 w-3.5 text-primary" />
                    {short}
                    <span className="ml-1 text-xs text-muted-foreground">
                      ~{formatHM(p.time)}
                    </span>
                    {p.pending > 0 && (
                      <span className="ml-0.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                        {p.pending}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {nudges.map((p) => {
          const Icon = ROUTINE_ICONS[p.icon];
          return (
            <div
              key={`nudge-${p.id}`}
              className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3"
            >
              <div className="flex items-center gap-2 mb-2">
                <Rocket className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-900">
                  Time to deliver these
                </span>
                <span className="text-xs text-emerald-700/80 inline-flex items-center gap-1">
                  <Icon className="h-3 w-3" /> {p.label}
                </span>
              </div>
              <div className="space-y-2">
                {p.tasks.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    onStart={() => startTask(t.id)}
                    onComplete={() => completeTask(t.id)}
                    onDelete={() => removeTask(t.id)}
                    onUpdate={(patch) => updateTask(t.id, patch)}
                    onSnooze={() =>
                      updateTask(t.id, {
                        due: new Date(
                          Math.max(Date.now(), new Date(t.due).getTime()) +
                            10 * 60 * 1000,
                        ).toISOString(),
                      })
                    }
                  />
                ))}
              </div>
            </div>
          );
        })}

        {sorted.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">📦</div>
            <p className="text-muted-foreground">
              No tasks today. Add one to get rolling.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                onStart={() => startTask(t.id)}
                onComplete={() => completeTask(t.id)}
                onDelete={() => removeTask(t.id)}
                onUpdate={(patch) => updateTask(t.id, patch)}
                onSnooze={() =>
                  updateTask(t.id, {
                    due: new Date(
                      Math.max(Date.now(), new Date(t.due).getTime()) +
                        10 * 60 * 1000,
                    ).toISOString(),
                  })
                }
              />
            ))}
          </div>
        )}
          </>
        )}
      </main>

      {/* Floating Add button + Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 pointer-events-none">
        {tab === "home" && (
          <div className="px-4 pb-2 bg-gradient-to-t from-background via-background to-transparent">
            <div className="max-w-xl mx-auto pointer-events-auto">
              <AddTaskDialog
                onAdd={addTask}
                trigger={
                  <Button
                    size="lg"
                    className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl shadow-lg text-base font-semibold"
                  >
                    <Plus className="h-5 w-5 mr-1" /> Add new task
                  </Button>
                }
              />
            </div>
          </div>
        )}
        <nav className="pointer-events-auto bg-card border-t">
          <div className="max-w-xl mx-auto grid grid-cols-2">
            <NavTab
              label="Home"
              Icon={Home}
              active={tab === "home"}
              onClick={() => setTab("home")}
            />
            <NavTab
              label="History"
              Icon={HistoryIcon}
              active={tab === "history"}
              onClick={() => setTab("history")}
            />
          </div>
        </nav>
      </div>

      {/* Redeliver dialog — controlled, opens with pre-filled values */}
      {redeliverInit && (
        <AddTaskDialog
          open
          onOpenChange={(v) => {
            if (!v) setRedeliverInit(null);
          }}
          initialValues={redeliverInit}
          onAdd={(input) => {
            addTask(input);
            setRedeliverInit(null);
            setTab("home");
            toast.success("Redelivered", { description: input.name });
          }}
        />
      )}
    </div>
  );
}

function NavTab({
  label,
  Icon,
  active,
  onClick,
}: {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-5 w-5" />
      {label}
    </button>
  );
}