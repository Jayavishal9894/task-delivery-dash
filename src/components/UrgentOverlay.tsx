import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { AlertOctagon, VolumeX } from "lucide-react";
import type { Task } from "@/lib/tasks";
import { DeliveryTracker } from "./DeliveryTracker";
import { taskStage } from "@/lib/tasks";
import {
  loadSettings,
  startAlarm,
  stopAlarm,
  startVibration,
  stopVibration,
} from "@/lib/alarm";

const NOTIFY_KEY = "trackit.lastNotify";

function notify(title: string, body: string) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, requireInteraction: true, tag: "trackit-urgent" });
  } catch {
    /* ignore */
  }
}

export function UrgentOverlay({
  tasks,
  onComplete,
}: {
  tasks: Task[];
  onComplete: (id: string) => void;
}) {
  // High-priority tasks at/after deadline trigger the full-screen alert.
  // Routine tasks never fire the overlay (no time-based deadline).
  const active = tasks.filter(
    (t) =>
      t.priority === "high" &&
      t.trigger !== "routine" &&
      !t.completedAt &&
      new Date(t.due).getTime() <= Date.now(),
  );
  const current = active[0];

  const lastNotifyRef = useRef<Record<string, number>>({});

  // 5-min-before + every 5 min after notifications for any urgent task
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    const tick = () => {
      const now = Date.now();
      let map: Record<string, number> = {};
      try {
        map = JSON.parse(localStorage.getItem(NOTIFY_KEY) ?? "{}");
      } catch {
        /* ignore */
      }
      for (const t of tasks) {
        if (t.priority !== "high" || t.trigger === "routine" || t.completedAt) continue;
        const due = new Date(t.due).getTime();
        const last = map[t.id] ?? 0;
        const preWindow = due - 5 * 60 * 1000;
        if (now >= preWindow && now < due && now - last >= 5 * 60 * 1000) {
          notify("Trackit · Due soon", `${t.name} is due in 5 minutes`);
          map[t.id] = now;
        } else if (now >= due && now - last >= 5 * 60 * 1000) {
          notify("Trackit · DO THIS NOW", t.name);
          map[t.id] = now;
        }
      }
      localStorage.setItem(NOTIFY_KEY, JSON.stringify(map));
    };
    tick();
    const i = setInterval(tick, 30 * 1000);
    return () => clearInterval(i);
  }, [tasks]);

  // Start alarm + vibration when overlay activates; stop on dismiss/complete
  const alarmActiveRef = useRef(false);
  const mutedRef = useRef(false);
  useEffect(() => {
    if (!current) {
      if (alarmActiveRef.current) {
        stopAlarm();
        stopVibration();
        alarmActiveRef.current = false;
        mutedRef.current = false;
      }
      return;
    }
    if (alarmActiveRef.current) return;
    const s = loadSettings();
    if (s.alarmEnabled && !mutedRef.current) startAlarm(s.alarmTone);
    if (s.vibrateEnabled) startVibration();
    alarmActiveRef.current = true;
    return () => {
      stopAlarm();
      stopVibration();
      alarmActiveRef.current = false;
    };
  }, [current?.id]);

  if (!current) return null;

  const handleMute = () => {
    mutedRef.current = true;
    stopAlarm();
    stopVibration();
  };

  return (
    <div className="fixed inset-0 z-50 bg-red-600 text-white flex flex-col items-center justify-center px-6 animate-fade-in">
      <AlertOctagon className="h-20 w-20 mb-6 animate-pulse" />
      <p className="text-sm uppercase tracking-widest font-semibold opacity-90">
        Do this now
      </p>
      <h1 className="text-4xl font-bold text-center mt-3 mb-6 leading-tight">
        {current.name}
      </h1>
      <div className="w-full max-w-sm bg-white/10 rounded-xl p-3 mb-8 backdrop-blur">
        <DeliveryTracker stage={taskStage(current)} overdue />
      </div>
      <Button
        size="lg"
        onClick={() => onComplete(current.id)}
        className="bg-white text-red-600 hover:bg-white/90 font-bold text-lg px-8 py-6 h-auto"
      >
        Mark done
      </Button>
      <button
        type="button"
        onClick={handleMute}
        className="mt-6 flex items-center gap-1.5 text-sm text-white/80 hover:text-white underline-offset-2 hover:underline"
      >
        <VolumeX className="h-4 w-4" /> Mute alarm
      </button>
    </div>
  );
}