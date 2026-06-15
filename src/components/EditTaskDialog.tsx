import { useEffect, useState } from "react";
import { AlertTriangle, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ROUTINES,
  DEFAULT_ROUTINE_TIMES,
  type Priority,
  type Recurrence,
  type Task,
  type TriggerType,
} from "@/lib/tasks";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

function timeFromISO(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function EditTaskDialog({
  task,
  open,
  onOpenChange,
  onSave,
}: {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (patch: Partial<Task>) => void;
}) {
  const [name, setName] = useState(task.name);
  const [time, setTime] = useState(timeFromISO(task.due));
  const [recurrence, setRecurrence] = useState<Recurrence>(task.recurrence);
  const [customDays, setCustomDays] = useState<number[]>(task.customDays ?? []);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [urgent, setUrgent] = useState(task.urgent);
  const [triggerType, setTriggerType] = useState<TriggerType>(task.trigger);
  const [routineKey, setRoutineKey] = useState<string>(
    task.routineKey ?? (task.routineLabel ? "__custom" : "lunch"),
  );
  const [customRoutine, setCustomRoutine] = useState(
    !task.routineKey && task.routineLabel ? task.routineLabel : "",
  );
  const [routineTime, setRoutineTime] = useState<string>(
    task.routineTime ??
      (task.routineKey ? DEFAULT_ROUTINE_TIMES[task.routineKey] : undefined) ??
      "13:00",
  );

  // Reset to task values whenever it (re)opens
  useEffect(() => {
    if (!open) return;
    setName(task.name);
    setTime(timeFromISO(task.due));
    setRecurrence(task.recurrence);
    setCustomDays(task.customDays ?? []);
    setPriority(task.priority);
    setUrgent(task.urgent);
    setTriggerType(task.trigger);
    setRoutineKey(task.routineKey ?? (task.routineLabel ? "__custom" : "lunch"));
    setCustomRoutine(!task.routineKey && task.routineLabel ? task.routineLabel : "");
    setRoutineTime(
      task.routineTime ??
        (task.routineKey ? DEFAULT_ROUTINE_TIMES[task.routineKey] : undefined) ??
        "13:00",
    );
  }, [open, task]);

  useEffect(() => {
    if (priority !== "high" && urgent) setUrgent(false);
  }, [priority, urgent]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = name.trim();
    if (!finalName) return;

    const patch: Partial<Task> = {
      name: finalName,
      recurrence,
      customDays: recurrence === "custom" ? customDays : undefined,
      priority,
      urgent: priority === "high" && urgent,
      trigger: triggerType,
    };

    if (triggerType === "time") {
      const [h, m] = time.split(":").map(Number);
      const due = new Date(task.due);
      due.setHours(h, m, 0, 0);
      patch.due = due.toISOString();
      patch.routineKey = undefined;
      patch.routineLabel = undefined;
    } else {
      const isCustom = routineKey === "__custom";
      const label = isCustom
        ? customRoutine.trim()
        : ROUTINES.find((r) => r.key === routineKey)?.label;
      if (!label) return;
      patch.routineKey = isCustom ? undefined : routineKey;
      patch.routineLabel = label;
      patch.routineTime = routineTime;
    }

    onSave(patch);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Edit task</span>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Task name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>When should this trigger?</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTriggerType("time")}
                className={`h-10 rounded-md border text-sm font-medium ${
                  triggerType === "time"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-input"
                }`}
              >
                At a specific time
              </button>
              <button
                type="button"
                onClick={() => setTriggerType("routine")}
                className={`h-10 rounded-md border text-sm font-medium ${
                  triggerType === "routine"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-input"
                }`}
              >
                After a routine
              </button>
            </div>
          </div>

          {triggerType === "time" ? (
            <div className="space-y-2">
              <Label htmlFor="edit-time">Due time</Label>
              <Input
                id="edit-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Routine anchor</Label>
              <Select
                value={routineKey}
                onValueChange={(v) => {
                  setRoutineKey(v);
                  const dt = DEFAULT_ROUTINE_TIMES[v];
                  if (dt) setRoutineTime(dt);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROUTINES.map((r) => (
                    <SelectItem key={r.key} value={r.key}>
                      {r.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="__custom">Custom routine…</SelectItem>
                </SelectContent>
              </Select>
              {routineKey === "__custom" && (
                <Input
                  placeholder="e.g. After my run"
                  value={customRoutine}
                  onChange={(e) => setCustomRoutine(e.target.value)}
                  maxLength={60}
                />
              )}
              <div className="space-y-1.5 pt-1">
                <Label htmlFor="edit-routine-time" className="text-sm">
                  What time do you usually do this routine?
                </Label>
                <Input
                  id="edit-routine-time"
                  type="time"
                  value={routineTime}
                  onChange={(e) => setRoutineTime(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Priority</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["low", "medium", "high"] as Priority[]).map((p) => {
                const active = priority === p;
                const cls =
                  p === "high"
                    ? active ? "bg-red-500 text-white border-red-500" : "text-red-600 border-red-200"
                    : p === "medium"
                      ? active ? "bg-amber-500 text-white border-amber-500" : "text-amber-700 border-amber-200"
                      : active ? "bg-slate-500 text-white border-slate-500" : "text-slate-600 border-slate-200";
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`h-10 rounded-md border text-sm font-semibold capitalize ${cls}`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
            {priority === "high" && (
              <div className="flex items-start gap-2 text-xs rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>This will interrupt you with a full screen alert at the deadline.</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Recurring</Label>
            <Select value={recurrence} onValueChange={(v) => setRecurrence(v as Recurrence)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">One-time</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="custom">Custom days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {recurrence === "custom" && (
            <div className="flex gap-1.5 justify-between">
              {DAYS.map((d, i) => {
                const active = customDays.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() =>
                      setCustomDays(
                        active ? customDays.filter((x) => x !== i) : [...customDays, i],
                      )
                    }
                    className={`flex-1 h-9 rounded-md border text-sm font-medium ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-input"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          )}

          <div className={`flex items-center justify-between rounded-lg border p-3 ${priority !== "high" ? "opacity-50" : ""}`}>
            <div className="flex items-center gap-2">
              <Label htmlFor="edit-urgent" className="font-semibold">
                Urgent mode
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground">
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {priority === "high"
                      ? "We'll keep alarming until you mark this done."
                      : "Only available on High priority tasks."}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Switch
              id="edit-urgent"
              checked={urgent}
              onCheckedChange={setUrgent}
              disabled={priority !== "high"}
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-primary hover:bg-primary/90"
              disabled={!name.trim()}
            >
              Save changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}