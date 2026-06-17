import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import {
  Flame, Package, Plus, WifiOff, Home, History as HistoryIcon,
  Sunrise, Sparkles, Coffee, Utensils, UtensilsCrossed, Moon, Building2, LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TaskCard } from "@/components/TaskCard";
import { AddTaskDialog } from "@/components/AddTaskDialog";
import { UrgentOverlay } from "@/components/UrgentOverlay";
import { SettingsDialog } from "@/components/SettingsDialog";
import { HistoryView } from "@/components/HistoryView";
import { useTaskStore, getStreak, todayISO, taskStage, ROUTINES, routineId } from "@/lib/tasks";
import type { Task, Recurrence, Priority, TriggerType } from "@/lib/tasks";
import { cn } from "@/lib/utils";

const ROUTINE_ICONS = {
  Sunrise, Sparkles, Coffee, Utensils, UtensilsCrossed, Moon, Building2, LogOut,
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
  const [streak, setStreak] = useState(0);
  const [online, setOnline] = useState(true);
  const [tab, setTab] = useState<"home" | "history">("home");
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

  // Routines attached to today's tasks. Includes fired ones so we can show
  // "Already checked in at HH:MM" state.
  const todaysRoutines = useMemo(() => {
    const m = new Map<
      string,
      { id: string; key?: string; label: string; pending: number; total: number; time?: string }
    >();
    for (const t of todays) {
      if (t.trigger !== "routine") continue;
      const id = routineId({ key: t.routineKey, label: t.routineLabel });
      if (!id) continue;
      const label =
        ROUTINES.find((r) => r.key === t.routineKey)?.label ??
        t.routineLabel ??
        "Routine";
      const prev = m.get(id);
      if (prev) {
        prev.total++;
        if (!t.completedAt && !t.workingAt) prev.pending++;
      } else {
        m.set(id, {
          id,
          key: t.routineKey,
          label,
          pending: t.completedAt || t.workingAt ? 0 : 1,
          total: 1,
          time: t.routineTime,
        });
      }
    }
    return [...m.values()];
  }, [todays]);
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
        {todaysRoutines.length > 0 && (
          <div className="mb-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Routine check-in
            </h2>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {todaysRoutines.map((r) => {
                const def = r.key ? ROUTINES.find((x) => x.key === r.key) : undefined;
                const Icon = def
                  ? ROUTINE_ICONS[def.icon as keyof typeof ROUTINE_ICONS]
                  : Sparkles;
                const firedAt = routineFires[r.id];
                const short = r.label.replace(/^After |^Before /, "");
                if (firedAt) {
                  const t = new Date(firedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <div
                      key={r.id}
                      className="flex items-center gap-1.5 whitespace-nowrap rounded-full border bg-muted/60 text-muted-foreground px-3 py-1.5 text-sm font-medium"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{short}</span>
                      <span className="ml-1 text-xs">checked in {t}</span>
                    </div>
                  );
                }
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      const count = r.key
                        ? fireRoutine({ key: r.key })
                        : fireRoutine({ label: r.label });
                      toast.success(`Done · ${r.label}`, {
                        description: `${count} task${count === 1 ? "" : "s"} nudged`,
                      });
                    }}
                    className="flex items-center gap-1.5 whitespace-nowrap rounded-full border bg-card px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-muted/50"
                  >
                    <Icon className="h-3.5 w-3.5 text-primary" />
                    Done · {short}
                    {r.time && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ~{formatHM(r.time)}
                      </span>
                    )}
                    <span className="ml-1 text-xs text-muted-foreground">
                      {r.pending}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

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