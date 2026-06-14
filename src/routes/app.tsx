import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import {
  Flame, Package, Plus, WifiOff,
  Sunrise, Sparkles, Coffee, Utensils, UtensilsCrossed, Moon, Building2, LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TaskCard } from "@/components/TaskCard";
import { AddTaskDialog } from "@/components/AddTaskDialog";
import { UrgentOverlay } from "@/components/UrgentOverlay";
import { SettingsDialog } from "@/components/SettingsDialog";
import { useTaskStore, getStreak, todayISO, taskStage, ROUTINES } from "@/lib/tasks";

const ROUTINE_ICONS = {
  Sunrise, Sparkles, Coffee, Utensils, UtensilsCrossed, Moon, Building2, LogOut,
} as const;

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
  const { tasks, addTask, startTask, completeTask, removeTask, updateTask, fireRoutine } =
    useTaskStore();
  const [streak, setStreak] = useState(0);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setStreak(getStreak());
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
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
    () => tasks.filter((t) => t.occurrenceDate === today),
    [tasks, today],
  );

  // Routines that have at least one pending task attached today
  const activeRoutines = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of todays) {
      if (t.trigger !== "routine" || t.completedAt || t.workingAt) continue;
      const k = t.routineKey ?? `custom:${t.routineLabel ?? ""}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return [...counts.entries()].map(([k, n]) => ({ k, n }));
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
    <div className="min-h-screen bg-muted/30 pb-32">
      <UrgentOverlay tasks={todays} onComplete={completeTask} />

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
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent pointer-events-none">
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
    </div>
  );
}