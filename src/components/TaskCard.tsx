import { useState, useEffect } from "react";
import { Check, Clock, Trash2, Zap } from "lucide-react";
import { DeliveryTracker } from "./DeliveryTracker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Task,
  taskStage,
  isOverdue,
  overdueMs,
  formatTime,
  formatOverdue,
} from "@/lib/tasks";
import { cn } from "@/lib/utils";

export function TaskCard({
  task,
  onStart,
  onComplete,
  onDelete,
}: {
  task: Task;
  onStart: () => void;
  onComplete: () => void;
  onDelete: () => void;
}) {
  const stage = taskStage(task);
  const overdue = isOverdue(task);
  const done = stage === 3;
  const [celebrate, setCelebrate] = useState(false);

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

  const badge = done
    ? { label: "Delivered", className: "bg-primary text-primary-foreground" }
    : overdue
      ? { label: "Delayed", className: "bg-red-500 text-white" }
      : stage > 0
        ? { label: "In progress", className: "bg-amber-500 text-white" }
        : { label: "Pending", className: "bg-muted text-foreground" };

  return (
    <div
      className={cn(
        "relative bg-card border rounded-2xl p-4 shadow-sm transition-all",
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
      <div className="flex items-start justify-between gap-2 mb-3">
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
        <Badge className={cn("text-xs flex-shrink-0", badge.className)}>
          {badge.label}
        </Badge>
      </div>

      <div className="py-2">
        <DeliveryTracker stage={stage} overdue={overdue && !done} />
      </div>

      {overdue && !done && (
        <div className="mt-3 text-xs text-red-600 bg-red-50 rounded-md px-2 py-1.5 font-medium">
          {formatOverdue(overdueMs(task))} · nudge sent
        </div>
      )}

      {!done && (
        <div className="flex gap-2 mt-3">
          {stage === 0 && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={onStart}
            >
              Start
            </Button>
          )}
          <Button
            size="sm"
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={onComplete}
          >
            <Check className="h-4 w-4 mr-1" /> Mark done
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-muted-foreground"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}