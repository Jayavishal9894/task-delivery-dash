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
import { ROUTINES, DEFAULT_ROUTINE_TIMES } from "@/lib/tasks";
import { parseTaskInput, describeParsed } from "@/lib/nlp";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function AddTaskDialog({
  trigger,
  onAdd,
  open: controlledOpen,
  onOpenChange,
  initialValues,
}: {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  initialValues?: {
    name?: string;
    time?: string;
    recurrence?: Recurrence;
    customDays?: number[];
    urgent?: boolean;
    priority?: Priority;
    trigger?: TriggerType;
    routineKey?: string;
    routineLabel?: string;
    routineTime?: string;
  };
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
    routineTime?: string;
  }) => void;
}) {
  const [openInternal, setOpenInternal] = useState(false);
  const open = controlledOpen ?? openInternal;
  const setOpen = (v: boolean) => {
    if (onOpenChange) onOpenChange(v);
    else setOpenInternal(v);
  };
  const [name, setName] = useState(initialValues?.name ?? "");
  const now = new Date();
  const defaultTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const [time, setTime] = useState(initialValues?.time ?? defaultTime);
  const [recurrence, setRecurrence] = useState<Recurrence>(initialValues?.recurrence ?? "none");
  const [customDays, setCustomDays] = useState<number[]>(initialValues?.customDays ?? []);
  const [urgent, setUrgent] = useState(initialValues?.urgent ?? false);
  const [priority, setPriority] = useState<Priority>(initialValues?.priority ?? "medium");
  const [triggerType, setTriggerType] = useState<TriggerType>(initialValues?.trigger ?? "time");
  const [routineKey, setRoutineKey] = useState<string>(initialValues?.routineKey ?? "lunch");
  const [customRoutine, setCustomRoutine] = useState(
    initialValues?.routineKey ? "" : initialValues?.routineLabel ?? "",
  );
  const [routineTime, setRoutineTime] = useState<string>(
    initialValues?.routineTime ?? DEFAULT_ROUTINE_TIMES[initialValues?.routineKey ?? "lunch"] ?? "13:00",
  );
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
      const dt = DEFAULT_ROUTINE_TIMES[parsed.routineKey];
      if (dt) setRoutineTime(dt);
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
    setRoutineTime(DEFAULT_ROUTINE_TIMES["lunch"] ?? "13:00");
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
      routineTime: triggerType === "routine" ? routineTime : undefined,
    });
    reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
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
          {/* Trigger type */}
          <div className="space-y-2">
            <Label>When should this trigger?</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTriggerType("time")}
                className={`h-10 rounded-md border text-sm font-medium transition-colors ${
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
                className={`h-10 rounded-md border text-sm font-medium transition-colors ${
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
              <Label htmlFor="time">Due time</Label>
              <Input
                id="time"
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
                <Label htmlFor="routine-time" className="text-sm">
                  What time do you usually do this routine?
                </Label>
                <Input
                  id="routine-time"
                  type="time"
                  value={routineTime}
                  onChange={(e) => setRoutineTime(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  We'll auto-nudge you at this time, or tap the routine on your home
                  screen to check in early.
                </p>
              </div>
            </div>
          )}

          {/* Priority */}
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
                    className={`h-10 rounded-md border text-sm font-semibold capitalize transition-colors ${cls}`}
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
          <div className={`flex items-center justify-between rounded-lg border p-3 ${priority !== "high" ? "opacity-50" : ""}`}>
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
                    {priority === "high"
                      ? "We'll keep alarming until you mark this done."
                      : "Only available on High priority tasks."}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Switch
              id="urgent"
              checked={urgent}
              onCheckedChange={setUrgent}
              disabled={priority !== "high"}
            />
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