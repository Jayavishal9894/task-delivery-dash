import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { AlertOctagon } from "lucide-react";
import type { Task } from "@/lib/tasks";

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
  // urgent tasks not completed and not dismissed for the deadline
  const active = tasks.filter(
    (t) => t.urgent && !t.completedAt && new Date(t.due).getTime() <= Date.now(),
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
        if (!t.urgent || t.completedAt) continue;
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

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-50 bg-red-600 text-white flex flex-col items-center justify-center px-6 animate-fade-in">
      <AlertOctagon className="h-20 w-20 mb-6 animate-pulse" />
      <p className="text-sm uppercase tracking-widest font-semibold opacity-90">
        Do this now
      </p>
      <h1 className="text-4xl font-bold text-center mt-3 mb-10 leading-tight">
        {current.name}
      </h1>
      <Button
        size="lg"
        onClick={() => onComplete(current.id)}
        className="bg-white text-red-600 hover:bg-white/90 font-bold text-lg px-8 py-6 h-auto"
      >
        Mark done
      </Button>
    </div>
  );
}