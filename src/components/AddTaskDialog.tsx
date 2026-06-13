import { useState } from "react";
import { Info } from "lucide-react";
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
import type { Recurrence } from "@/lib/tasks";

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

  const reset = () => {
    setName("");
    setTime(defaultTime);
    setRecurrence("none");
    setCustomDays([]);
    setUrgent(false);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 120) return;
    onAdd({
      name: trimmed,
      time,
      recurrence,
      customDays: recurrence === "custom" ? customDays : undefined,
      urgent,
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
              placeholder="Ship the report"
              maxLength={120}
              autoFocus
            />
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