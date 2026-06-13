import { useEffect, useState } from "react";
import { Settings as SettingsIcon, Play } from "lucide-react";
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
import {
  loadSettings,
  saveSettings,
  previewTone,
  type AlarmTone,
  type AppSettings,
} from "@/lib/alarm";

const TONES: { id: AlarmTone; label: string; desc: string }[] = [
  { id: "beep", label: "Beep", desc: "Sharp square-wave pulse" },
  { id: "klaxon", label: "Klaxon", desc: "Sweeping siren" },
  { id: "chime", label: "Chime", desc: "Pleasant triad" },
];

export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState<AppSettings | null>(null);

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
      <DialogContent className="sm:max-w-md">
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}