import { Check, X, Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeliveryTracker } from "./DeliveryTracker";
import {
  Task,
  taskStage,
  formatTime,
} from "@/lib/tasks";
import { cn } from "@/lib/utils";

export type HistoryKind = "completed" | "failed" | "deleted";

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

function daysUntilPurge(deletedAt: string): number {
  const ms = new Date(deletedAt).getTime() + 30 * 24 * 60 * 60 * 1000 - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

function overdueLabel(due: string, ref?: string): string {
  const r = ref ? new Date(ref).getTime() : Date.now();
  const ms = Math.max(0, r - new Date(due).getTime());
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m} min overdue`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} hour${h === 1 ? "" : "s"} overdue`;
  return `${Math.floor(h / 24)} days overdue`;
}

export function HistoryTaskRow({
  task,
  kind,
  onRedeliver,
  onRestore,
  onPurge,
}: {
  task: Task;
  kind: HistoryKind;
  onRedeliver: () => void;
  onRestore?: () => void;
  onPurge?: () => void;
}) {
  const stage = taskStage(task);
  const failed = kind === "failed";
  return (
    <div
      className={cn(
        "bg-card border rounded-2xl p-4 shadow-sm space-y-3",
        failed && "border-red-200 bg-red-50/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-foreground truncate">{task.name}</h3>
            <PriorityBadge priority={task.priority} />
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Due {formatTime(task.due)}
          </div>
        </div>
        <div
          className={cn(
            "h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0",
            kind === "completed" && "bg-primary text-primary-foreground",
            kind === "failed" && "bg-red-500 text-white",
            kind === "deleted" && "bg-muted text-muted-foreground",
          )}
        >
          {kind === "completed" ? (
            <Check className="h-4 w-4" strokeWidth={3} />
          ) : kind === "failed" ? (
            <X className="h-4 w-4" strokeWidth={3} />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </div>
      </div>

      <DeliveryTracker
        stage={kind === "completed" ? 3 : stage}
        overdue={failed}
      />

      {kind === "completed" && task.completedAt && (
        <div className="space-y-1">
          <div className="text-sm font-semibold text-primary">
            Delivered at {formatTime(task.completedAt)}
          </div>
          <div className="text-xs text-muted-foreground">
            🔥 This task kept your streak alive
          </div>
        </div>
      )}
      {kind === "failed" && (
        <div className="space-y-1">
          <div className="text-sm font-semibold text-red-600">Never delivered</div>
          <div className="text-xs text-red-500/80">{overdueLabel(task.due)}</div>
        </div>
      )}
      {kind === "deleted" && task.deletedAt && (
        <div className="space-y-1">
          <div className="text-sm font-semibold text-muted-foreground">
            Deleted at {formatTime(task.deletedAt)}
          </div>
          <div className="text-xs text-muted-foreground">
            Deletes permanently in {daysUntilPurge(task.deletedAt)} day
            {daysUntilPurge(task.deletedAt) === 1 ? "" : "s"}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button
          variant="outline"
          className="flex-1 h-10 rounded-xl"
          onClick={onRedeliver}
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1" /> Redeliver this task
        </Button>
        {kind === "deleted" && onRestore && (
          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={onRestore}
          >
            Restore
          </Button>
        )}
        {kind === "deleted" && onPurge && (
          <Button
            variant="ghost"
            className="h-10 rounded-xl text-muted-foreground"
            onClick={onPurge}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}