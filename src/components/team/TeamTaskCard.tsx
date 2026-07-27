import { useState } from "react";
import { Clock, Trash2, UserRound, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DeliveryTracker } from "@/components/DeliveryTracker";
import { cn } from "@/lib/utils";
import {
  teamOverdue,
  teamProgress,
  teamStage,
  type TeamTask,
} from "@/lib/team";

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-50 text-red-600 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-muted text-muted-foreground border-border",
};

export function TeamTaskCard({
  task,
  assigneeName,
  canDelete,
  canAdvance,
  onAdvance,
  onDelete,
}: {
  task: TeamTask;
  assigneeName: string;
  canDelete: boolean;
  canAdvance: boolean;
  onAdvance: (to: 1 | 2 | 3) => void;
  onDelete: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const stage = teamStage(task);
  const overdue = teamOverdue(task);
  const pct = teamProgress(task);

  const run = async (to: 1 | 2 | 3) => {
    setBusy(true);
    try {
      await onAdvance(to);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={cn(
        "bg-card border rounded-2xl p-4 shadow-sm",
        overdue && "border-red-300",
        stage === 3 && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3
            className={cn(
              "font-semibold leading-tight",
              stage === 3 && "line-through text-muted-foreground",
            )}
          >
            {task.name}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <UserRound className="h-3.5 w-3.5" />
              {assigneeName}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {new Date(task.due_at).toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 font-medium capitalize",
                PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.low,
              )}
            >
              {task.priority}
            </span>
            {overdue && (
              <span className="rounded-full bg-red-500 text-white px-2 py-0.5 font-semibold">
                Delayed
              </span>
            )}
          </div>
        </div>
        {canDelete && (
          <button
            type="button"
            aria-label="Delete task"
            onClick={onDelete}
            className="text-muted-foreground hover:text-red-500 shrink-0"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {task.description && (
        <p className="text-sm text-muted-foreground mb-3">{task.description}</p>
      )}

      <DeliveryTracker stage={stage} overdue={overdue} />

      <div className="mt-3 flex items-center gap-3">
        <Progress value={pct} className="h-2 flex-1" />
        <span className="text-xs font-semibold text-muted-foreground">
          {pct}%
        </span>
      </div>

      {canAdvance && stage < 3 && (
        <div className="mt-3 flex gap-2">
          {stage < 2 && (
            <Button
              variant="outline"
              className="flex-1"
              disabled={busy}
              onClick={() => run(2)}
            >
              <Zap className="h-4 w-4 mr-1" /> Start working
            </Button>
          )}
          <Button className="flex-1" disabled={busy} onClick={() => run(3)}>
            Mark as delivered
          </Button>
        </div>
      )}
    </div>
  );
}