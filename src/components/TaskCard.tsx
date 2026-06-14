import { useState, useEffect } from "react";
import { Check, Clock, Zap, Share2, Pencil } from "lucide-react";
import { DeliveryTracker } from "./DeliveryTracker";
import { Button } from "@/components/ui/button";
import {
  Task,
  taskStage,
  isOverdue,
  formatTime,
} from "@/lib/tasks";
import { cn } from "@/lib/utils";

export function TaskCard({
  task,
  onStart,
  onComplete,
  onDelete,
  onSnooze,
}: {
  task: Task;
  onStart: () => void;
  onComplete: () => void;
  onDelete: () => void;
  onSnooze: () => void;
}) {
  const stage = taskStage(task);
  const overdue = isOverdue(task);
  const done = stage === 3;
  const [celebrate, setCelebrate] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    if (done) return;
    const i = setInterval(() => tick((x) => x + 1), 30000);
    return () => clearInterval(i);
  }, [done]);

  useEffect(() => {
    if (done && task.completedAt) {
      const age = Date.now() - new Date(task.completedAt).getTime();
      if (age < 3000) {
        setCelebrate(true);
        const t = setTimeout(() => setCelebrate(false), 2000);
        return () => clearTimeout(t);
      }
    }
  }, [done, task.completedAt]);

  const pct = done ? 100 : Math.round((stage / 3) * 100) + (stage < 3 ? 5 : 0);
  const dueDate = new Date(task.due);
  const msLeft = dueDate.getTime() - Date.now();
  const timeLeft = formatRemaining(msLeft);

  const handleShare = async () => {
    const text = `${task.name} — due ${formatTime(task.due)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: task.name, text });
      } catch {
        /* ignore */
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <div
      className={cn(
        "relative bg-card border rounded-2xl p-5 shadow-sm transition-all space-y-4",
        overdue && !done && "border-red-300",
        done && "opacity-70",
      )}
    >
      {celebrate && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-primary/95 text-primary-foreground z-10 animate-fade-in">
          <div className="text-center">
            <div className="text-3xl mb-1">🎉</div>
            <div className="font-bold">Task Delivered!</div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground truncate">{task.name}</h3>
            {task.urgent && (
              <Zap className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <Clock className="h-3 w-3" />
            <span>Due {formatTime(task.due)}</span>
          </div>
        </div>
        <div className="text-primary font-bold text-lg flex-shrink-0">{pct}%</div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Tracker */}
      <div className="pt-1">
        <DeliveryTracker stage={stage} overdue={overdue && !done} />
      </div>

      {/* Time remaining */}
      {!done && (
        <div className="bg-muted/40 border rounded-xl p-3">
          <div className="text-[10px] font-semibold tracking-wider text-muted-foreground">
            TIME REMAINING
          </div>
          <div
            className={cn(
              "text-xl font-bold mt-0.5",
              overdue ? "text-red-500" : "text-primary",
            )}
          >
            {timeLeft}
          </div>
          <div className="text-xs text-muted-foreground">
            Ends at {formatTime(task.due)}
          </div>
        </div>
      )}

      {/* About */}
      {task.description && (
        <div className="bg-muted/40 border rounded-xl p-3">
          <div className="text-[10px] font-semibold tracking-wider text-muted-foreground">
            ABOUT THIS TASK
          </div>
          <p className="text-sm text-foreground mt-1 leading-snug">
            {task.description}
          </p>
        </div>
      )}

      {/* Actions */}
      {!done && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 h-11 rounded-xl bg-background"
              onClick={() => {
                if (stage === 0) onStart();
                onSnooze();
              }}
            >
              <Clock className="h-4 w-4 mr-1" /> Snooze
            </Button>
            <Button
              className="flex-1 h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white"
              onClick={onComplete}
            >
              <Check className="h-4 w-4 mr-1" strokeWidth={3} /> Mark as Done
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              className="flex-1 h-11 rounded-xl bg-black hover:bg-black/90 text-white"
              onClick={onDelete}
            >
              <Pencil className="h-4 w-4 mr-1" /> Edit
            </Button>
            <Button
              className="flex-1 h-11 rounded-xl bg-black hover:bg-black/90 text-white"
              onClick={handleShare}
            >
              <Share2 className="h-4 w-4 mr-1" /> Share
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatRemaining(ms: number): string {
  if (ms <= 0) {
    const over = Math.abs(ms);
    const m = Math.floor(over / 60000);
    if (m < 60) return `${m}m overdue`;
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}h ${rm}m overdue`;
  }
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m left`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m left`;
}