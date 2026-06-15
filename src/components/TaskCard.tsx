import { useState, useEffect } from "react";
import {
  Check, Clock, Zap, Share2, Pencil,
  Sunrise, Sparkles, Coffee, Utensils, UtensilsCrossed, Moon, Building2, LogOut, Star,
} from "lucide-react";
import { DeliveryTracker } from "./DeliveryTracker";
import { EditTaskDialog } from "./EditTaskDialog";
import { CelebrationOverlay } from "./CelebrationOverlay";
import { Button } from "@/components/ui/button";
import {
  Task,
  taskStage,
  isOverdue,
  formatTime,
  progressPercent,
  routineByKey,
} from "@/lib/tasks";
import { cn } from "@/lib/utils";

const ROUTINE_ICONS = {
  Sunrise, Sparkles, Coffee, Utensils, UtensilsCrossed, Moon, Building2, LogOut, Star,
} as const;

export function TaskCard({
  task,
  onStart,
  onComplete,
  onDelete,
  onSnooze,
  onUpdate,
}: {
  task: Task;
  onStart: () => void;
  onComplete: () => void;
  onDelete: () => void;
  onSnooze: () => void;
  onUpdate: (patch: Partial<Task>) => void;
}) {
  const stage = taskStage(task);
  const overdue = isOverdue(task);
  const done = stage === 3;
  const [celebrate, setCelebrate] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    if (done) return;
    const i = setInterval(() => tick((x) => x + 1), 15000);
    return () => clearInterval(i);
  }, [done]);

  const pct = progressPercent(task);
  const justAdded =
    !!task.createdAt && Date.now() - new Date(task.createdAt).getTime() < 1500;
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

  const handleComplete = () => {
    setCelebrate(true);
    onComplete();
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
        <CelebrationOverlay
          taskName={task.name}
          completedAt={task.completedAt ? new Date(task.completedAt) : new Date()}
          onDismiss={() => setCelebrate(false)}
        />
      )}
      <EditTaskDialog
        task={task}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={onUpdate}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground truncate">{task.name}</h3>
            <PriorityBadge priority={task.priority} />
            {task.urgent && (
              <Zap className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
            )}
          </div>
          <TaskMeta task={task} />
        </div>
        <div className="text-primary font-bold text-lg flex-shrink-0">{pct}%</div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-500",
            done ? "bg-primary" : overdue ? "bg-red-500" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Tracker */}
      <div className="pt-1">
        <DeliveryTracker
          stage={stage}
          overdue={overdue && !done}
          justAdded={justAdded}
        />
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
              onClick={handleComplete}
            >
              <Check className="h-4 w-4 mr-1" strokeWidth={3} /> Mark as Done
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              className="flex-1 h-11 rounded-xl bg-black hover:bg-black/90 text-white"
              onClick={() => setEditOpen(true)}
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

function PriorityBadge({ priority }: { priority: Task["priority"] }) {
  const map = {
    high: "bg-red-100 text-red-700 border-red-200",
    medium: "bg-amber-100 text-amber-700 border-amber-200",
    low: "bg-slate-100 text-slate-600 border-slate-200",
  } as const;
  return (
    <span
      className={cn(
        "text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border",
        map[priority] ?? map.medium,
      )}
    >
      {priority}
    </span>
  );
}

function TaskMeta({ task }: { task: Task }) {
  if (task.trigger === "routine") {
    const def = routineByKey(task.routineKey);
    const Icon = def ? ROUTINE_ICONS[def.icon] : Star;
    const label = def?.label ?? task.routineLabel ?? "Routine";
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
        <Icon className="h-3 w-3" />
        <span>{label}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
      <Clock className="h-3 w-3" />
      <span>Due {formatTime(task.due)}</span>
    </div>
  );
}