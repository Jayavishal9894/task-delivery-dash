import { useEffect, useState } from "react";
import { Settings as SettingsIcon, Play, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  loadSettings,
  saveSettings,
  previewTone,
  type AlarmTone,
  type AppSettings,
} from "@/lib/alarm";
import {
  useRoutineConfigs,
  isEnabledToday,
} from "@/lib/routineConfig";

const TONES: { id: AlarmTone; label: string; desc: string }[] = [
  { id: "beep", label: "Beep", desc: "Sharp square-wave pulse" },
  { id: "klaxon", label: "Klaxon", desc: "Sweeping siren" },
  { id: "chime", label: "Chime", desc: "Pleasant triad" },
];

export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState<AppSettings | null>(null);
  const { configs, updateConfig, toggleToday, addCustom, removeCustom } =
    useRoutineConfigs();
  const [newLabel, setNewLabel] = useState("");
  const [newTime, setNewTime] = useState("12:00");

  useEffect(() => {
    if (open) setS(loadSettings());
  }, [open]);

  const update = (patch: Partial<AppSettings>) => {
    if (!s) return;
    const next = { ...s, ...patch };
    setS(next);
    saveSettings(next);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
          aria-label="Settings"
        >
          <SettingsIcon className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        {s && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-semibold">Urgent alarm</Label>
                <p className="text-xs text-muted-foreground">
                  Loud loop until you mark done
                </p>
              </div>
              <Switch
                checked={s.alarmEnabled}
                onCheckedChange={(v) => update({ alarmEnabled: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-semibold">Vibration</Label>
                <p className="text-xs text-muted-foreground">
                  Continuous pulse on supported devices
                </p>
              </div>
              <Switch
                checked={s.vibrateEnabled}
                onCheckedChange={(v) => update({ vibrateEnabled: v })}
              />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Alarm tone</Label>
              <div className="space-y-2">
                {TONES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => update({ alarmTone: t.id })}
                    className={`w-full text-left flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                      s.alarmTone === t.id
                        ? "border-primary bg-primary/5"
                        : "border-input"
                    }`}
                  >
                    <div
                      className={`h-4 w-4 rounded-full border-2 flex-shrink-0 ${
                        s.alarmTone === t.id
                          ? "border-primary bg-primary"
                          : "border-muted-foreground/40"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{t.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.desc}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        previewTone(t.id);
                      }}
                    >
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3 pt-2 border-t">
              <div>
                <Label className="font-semibold">Routines</Label>
                <p className="text-xs text-muted-foreground">
                  Set the approximate time you usually do each routine. Toggle
                  off to skip today.
                </p>
              </div>
              <div className="space-y-2">
                {configs.map((c) => {
                  const enabled = isEnabledToday(c);
                  return (
                    <div
                      key={c.id}
                      className="flex items-center gap-2 rounded-lg border p-2.5"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {c.label}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {c.custom ? "Custom" : "Built-in"}
                        </div>
                      </div>
                      <Input
                        type="time"
                        value={c.time}
                        onChange={(e) =>
                          updateConfig(c.id, { time: e.target.value })
                        }
                        className="w-[110px] h-8"
                      />
                      <Switch
                        checked={enabled}
                        onCheckedChange={() => toggleToday(c.id)}
                        aria-label={`Enable ${c.label} today`}
                      />
                      {c.custom && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeCustom(c.id)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="rounded-lg border border-dashed p-2.5 space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Add custom routine
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="e.g. After workout"
                    className="flex-1 h-8"
                  />
                  <Input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-[110px] h-8"
                  />
                  <Button
                    type="button"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      if (!newLabel.trim()) return;
                      addCustom(newLabel, newTime);
                      setNewLabel("");
                      setNewTime("12:00");
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}