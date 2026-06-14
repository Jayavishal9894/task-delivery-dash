import { useState, useMemo, useEffect } from "react";
import { Info, Sparkles, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import type { Recurrence, Priority, TriggerType } from "@/lib/tasks";
import { ROUTINES } from "@/lib/tasks";
import { parseTaskInput, describeParsed } from "@/lib/nlp";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function AddTaskDialog({
  trigger,
  onAdd,
}: {
  trigger: React.ReactNode;
  onAdd: (input: {
    name: string;
    time: string;
    recurrence: Recurrence;
    customDays?: number[];
    urgent: boolean;
    priority: Priority;
    trigger: TriggerType;
    routineKey?: string;
    routineLabel?: string;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const now = new Date();
  const defaultTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const [time, setTime] = useState(defaultTime);
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [urgent, setUrgent] = useState(false);
  const [priority, setPriority] = useState<Priority>("medium");
  const [triggerType, setTriggerType] = useState<TriggerType>("time");
  const [routineKey, setRoutineKey] = useState<string>("lunch");
  const [customRoutine, setCustomRoutine] = useState("");
  const [autoApplied, setAutoApplied] = useState(false);
  const [dismissedDetection, setDismissedDetection] = useState(false);

  const parsed = useMemo(() => parseTaskInput(name), [name]);
  const hasDetection =
    !!parsed.time ||
    !!parsed.date ||
    !!parsed.recurrence ||
    !!parsed.urgent ||
    !!parsed.priority ||
    !!parsed.routineKey;

  // Auto-apply detected values once per change, but never overwrite a manual edit
  useEffect(() => {
    if (!hasDetection || dismissedDetection) return;
    if (parsed.time) setTime(parsed.time);
    if (parsed.recurrence) {
      setRecurrence(parsed.recurrence);
      if (parsed.customDays) setCustomDays(parsed.customDays);
    }
    if (parsed.urgent) setUrgent(true);
    if (parsed.priority) setPriority(parsed.priority);
    if (parsed.routineKey) {
      setTriggerType("routine");
      setRoutineKey(parsed.routineKey);
    }
    setAutoApplied(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    parsed.time,
    parsed.recurrence,
    parsed.urgent,
    parsed.priority,
    parsed.routineKey,
    JSON.stringify(parsed.customDays),
  ]);

  // Urgent toggle is only meaningful on high priority
  useEffect(() => {
    if (priority !== "high" && urgent) setUrgent(false);
  }, [priority, urgent]);

  const reset = () => {
    setName("");
    setTime(defaultTime);
    setRecurrence("none");
    setCustomDays([]);
    setUrgent(false);
    setPriority("medium");
    setTriggerType("time");
    setRoutineKey("lunch");
    setCustomRoutine("");
    setAutoApplied(false);
    setDismissedDetection(false);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // Prefer the stripped name from the NLP parser when detection ran
    const finalName = (hasDetection && !dismissedDetection ? parsed.name : name).trim();
    if (!finalName || finalName.length > 120) return;
    const isCustom = routineKey === "__custom";
    const routineLabel = isCustom
      ? customRoutine.trim()
      : ROUTINES.find((r) => r.key === routineKey)?.label;
    if (triggerType === "routine" && !routineLabel) return;
    onAdd({
      name: finalName,
      time,
      recurrence,
      customDays: recurrence === "custom" ? customDays : undefined,
      urgent,
      priority,
      trigger: triggerType,
      routineKey: triggerType === "routine" ? (isCustom ? undefined : routineKey) : undefined,
      routineLabel: triggerType === "routine" ? routineLabel : undefined,
    });
    reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Task name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='Try "Call mom tomorrow at 6pm" or "Workout every weekday urgent"'
              maxLength={120}
              autoFocus
            />
            {hasDetection && !dismissedDetection && (
              <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
                <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground">We detected</div>
                  <div className="text-muted-foreground truncate">
                    {describeParsed(parsed)}
                  </div>
                  {parsed.name && parsed.name !== name.trim() && (
                    <div className="text-muted-foreground mt-1">
                      Saving as: <span className="text-foreground font-medium">{parsed.name}</span>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setDismissedDetection(true)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Dismiss detection"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="time">Due time</Label>
            <Input
              id="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
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
                    className={`flex-1 h-9 rounded-md border text-sm font-medium transition-colors ${
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
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="urgent" className="font-semibold">
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
                    We'll annoy you until this is done
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Switch id="urgent" checked={urgent} onCheckedChange={setUrgent} />
          </div>
          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90"
            disabled={!name.trim()}
          >
            Add task
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}