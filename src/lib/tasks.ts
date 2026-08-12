import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Recurrence = "none" | "daily" | "weekly" | "custom";
export type Priority = "low" | "medium" | "high";
export type TriggerType = "time" | "routine";

export type RoutineDef = {
  key: string;
  label: string;
  icon:
    | "Sunrise"
    | "Sparkles"
    | "Coffee"
    | "Utensils"
    | "UtensilsCrossed"
    | "Moon"
    | "Building2"
    | "LogOut"
    | "Star";
};

export const ROUTINES: RoutineDef[] = [
  { key: "wake", label: "After waking up", icon: "Sunrise" },
  { key: "teeth", label: "After brushing teeth", icon: "Sparkles" },
  { key: "breakfast", label: "After breakfast", icon: "Coffee" },
  { key: "lunch", label: "After lunch", icon: "Utensils" },
  { key: "dinner", label: "After dinner", icon: "UtensilsCrossed" },
  { key: "sleep", label: "Before sleeping", icon: "Moon" },
  { key: "office_in", label: "After reaching office", icon: "Building2" },
  { key: "office_out", label: "After leaving office", icon: "LogOut" },
];

export const routineByKey = (k?: string) =>
  k ? ROUTINES.find((r) => r.key === k) : undefined;

// Default approximate trigger time for each predefined routine (HH:MM, 24h)
export const DEFAULT_ROUTINE_TIMES: Record<string, string> = {
  wake: "07:00",
  teeth: "07:15",
  breakfast: "08:30",
  lunch: "13:00",
  dinner: "20:00",
  sleep: "23:00",
  office_in: "09:30",
  office_out: "18:30",
};

export const routineId = (m: { key?: string; label?: string }): string => {
  if (m.key) return `k:${m.key}`;
  if (m.label) return `l:${m.label.trim().toLowerCase()}`;
  return "";
};

export type Task = {
  id: string;
  name: string;
  description?: string;
  // ISO datetime for due
  due: string;
  recurrence: Recurrence;
  // 0-6 (Sun-Sat) for custom/weekly
  customDays?: number[];
  urgent: boolean;
  priority: Priority;
  trigger: TriggerType;
  // routine key (predefined) OR free-text custom label
  routineKey?: string;
  routineLabel?: string;
  // For routine-triggered tasks: approximate time of day to auto-fire (HH:MM)
  routineTime?: string;
  // ISO date (YYYY-MM-DD) for the occurrence this task represents
  occurrenceDate: string;
  createdAt?: string;
  startedAt?: string;
  workingAt?: string;
  completedAt?: string;
  // Template id this occurrence was generated from (for recurring)
  templateId?: string;
  urgentDismissed?: boolean;
  // Notifications fired
  notified30?: boolean;
  notified10?: boolean;
  notifiedDue?: boolean;
  // Soft delete — moved to History "Deleted" section
  deletedAt?: string;
};

export type Template = {
  id: string;
  name: string;
  time: string; // HH:MM
  recurrence: Recurrence;
  customDays?: number[];
  urgent: boolean;
  createdAt: string;
  // last occurrenceDate generated
  lastGenerated?: string;
};

const TASKS_KEY = "trackit.tasks.v1";
const TEMPLATES_KEY = "trackit.templates.v1";
const STREAK_KEY = "trackit.streak.v1";
const ROUTINE_FIRES_KEY = "trackit.routineFires.v1";

const scopedKey = (base: string, userId: string | null) =>
  userId ? `${base}.${userId}` : base;

type RoutineFires = { date: string; fires: Record<string, string> };
const emptyFires = (): RoutineFires => ({ date: todayISO(), fires: {} });

const notify = (
  title: string,
  body: string,
  opts: { silent?: boolean; persistent?: boolean } = {},
) => {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") {
    if (Notification.permission === "default") {
      try { Notification.requestPermission().catch(() => {}); } catch { /* ignore */ }
    }
    return;
  }
  try {
    new Notification(title, {
      body,
      tag: `trackit-${title}-${body.slice(0, 12)}`,
      silent: opts.silent,
      requireInteraction: opts.persistent,
    });
  } catch {
    /* ignore */
  }
};

const vibrate = (pattern: number | number[]) => {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  try { navigator.vibrate(pattern); } catch { /* ignore */ }
};

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const load = <T>(k: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const save = (k: string, v: unknown) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(k, JSON.stringify(v));
};

const dayMatchesTemplate = (t: Template, date: Date) => {
  if (t.recurrence === "daily") return true;
  if (t.recurrence === "weekly")
    return date.getDay() === new Date(t.createdAt).getDay();
  if (t.recurrence === "custom") return t.customDays?.includes(date.getDay()) ?? false;
  return false;
};

const generateRecurringForToday = (templates: Template[], tasks: Task[]): Task[] => {
  const today = todayISO();
  const date = new Date();
  const newTasks: Task[] = [];
  for (const t of templates) {
    if (t.recurrence === "none") continue;
    if (!dayMatchesTemplate(t, date)) continue;
    const exists = tasks.some(
      (task) => task.templateId === t.id && task.occurrenceDate === today,
    );
    if (exists) continue;
    const [h, m] = t.time.split(":").map(Number);
    const due = new Date();
    due.setHours(h, m, 0, 0);
    newTasks.push({
      id: crypto.randomUUID(),
      name: t.name,
      due: due.toISOString(),
      recurrence: t.recurrence,
      customDays: t.customDays,
      urgent: t.urgent,
      priority: t.urgent ? "high" : "medium",
      trigger: "time",
      occurrenceDate: today,
      templateId: t.id,
      createdAt: new Date().toISOString(),
    });
  }
  return newTasks;
};

export const useTaskStore = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [routineFires, setRoutineFires] = useState<RoutineFires>(emptyFires);
  const [userId, setUserId] = useState<string | null>(null);
  const [, force] = useState(0);

  const tasksKey = scopedKey(TASKS_KEY, userId);
  const templatesKey = scopedKey(TEMPLATES_KEY, userId);
  const streakKey = scopedKey(STREAK_KEY, userId);
  const firesKey = scopedKey(ROUTINE_FIRES_KEY, userId);

  const loadFiresForUser = useCallback((): RoutineFires => {
    const f = load<RoutineFires>(firesKey, emptyFires());
    if (f.date !== todayISO()) {
      const fresh = emptyFires();
      save(firesKey, fresh);
      return fresh;
    }
    return f;
  }, [firesKey]);

  const saveFiresForUser = useCallback(
    (f: RoutineFires) => save(firesKey, f),
    [firesKey],
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (userId === null) return;

    let loaded = load<Task[]>(tasksKey, []);
    let tmpls = load<Template[]>(templatesKey, []);

    // One-time migration: if the user-scoped key is empty but legacy
    // unscoped data exists, copy it over so existing users keep their tasks.
    if (loaded.length === 0) {
      const legacy = load<Task[]>(TASKS_KEY, []);
      if (legacy.length > 0) {
        loaded = legacy;
        save(tasksKey, legacy);
      }
    }
    if (tmpls.length === 0) {
      const legacy = load<Template[]>(TEMPLATES_KEY, []);
      if (legacy.length > 0) {
        tmpls = legacy;
        save(templatesKey, legacy);
      }
    }

    // Auto-purge soft-deleted tasks older than 30 days
    const purgeCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const surviving = loaded.filter(
      (t) => !t.deletedAt || new Date(t.deletedAt).getTime() > purgeCutoff,
    );
    const generated = generateRecurringForToday(tmpls, surviving);
    // Migrate legacy tasks: urgent → high priority; default trigger=time, priority=medium
    const migrated: Task[] = [...surviving, ...generated].map((t) => ({
      ...t,
      priority: (t as Task).priority ?? (t.urgent ? "high" : "medium"),
      trigger: (t as Task).trigger ?? "time",
    }));
    const merged = migrated;
    if (generated.length || surviving.length !== loaded.length || merged.length !== loaded.length)
      save(tasksKey, merged);
    setTasks(merged);
    setTemplates(tmpls);
    setRoutineFires(loadFiresForUser());
  }, [userId, tasksKey, templatesKey, loadFiresForUser]);

  // tick every 15s: re-evaluate overdue, auto-advance to "In Progress" 30 min
  // before deadline, and fire 10-min / due notifications
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      let changed = false;
      // Auto-fire routine-triggered tasks whose routineTime has arrived
      const fires = loadFiresForUser();
      const nowD = new Date();
      const hhmm = `${String(nowD.getHours()).padStart(2, "0")}:${String(nowD.getMinutes()).padStart(2, "0")}`;
      const today = todayISO();
      const toFire = new Map<string, { key?: string; label?: string; label2: string }>();
      setTasks((prev) => {
        for (const t of prev) {
          if (t.completedAt) continue;
        if (t.deletedAt) continue;
          if (t.trigger !== "routine") continue;
          if (t.occurrenceDate !== today) continue;
          if (!t.routineTime) continue;
          if (t.routineTime > hhmm) continue;
          const id = routineId({ key: t.routineKey, label: t.routineLabel });
          if (!id || fires.fires[id] || toFire.has(id)) continue;
          const label =
            t.routineLabel ??
            ROUTINES.find((r) => r.key === t.routineKey)?.label ??
            "Routine";
          toFire.set(id, { key: t.routineKey, label: t.routineLabel, label2: label });
        }
        const next = prev.map((t) => {
          if (t.deletedAt) return t;
          if (t.completedAt) return t;
          // Apply auto-fire to matching routine tasks
          if (t.trigger === "routine" && t.occurrenceDate === today) {
            const id = routineId({ key: t.routineKey, label: t.routineLabel });
            if (id && toFire.has(id)) {
              changed = true;
              return {
                ...t,
                startedAt: t.startedAt ?? new Date().toISOString(),
                workingAt: new Date().toISOString(),
                due: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
              };
            }
          }
          // Routine-based tasks don't auto-advance by time
          if (t.trigger === "routine") return t;
          const due = new Date(t.due).getTime();
          const msLeft = due - now;
          const patch: Partial<Task> = {};
          // auto move to In Progress 30 min before deadline
          if (!t.workingAt && msLeft <= 30 * 60 * 1000 && msLeft > -60 * 1000) {
            patch.startedAt = t.startedAt ?? new Date().toISOString();
            patch.workingAt = new Date().toISOString();
            notify("Trackit", `Your task "${t.name}" is now in progress — time to start.`, {
              silent: t.priority === "low",
              persistent: t.priority !== "low",
            });
          }
          if (!t.notified10 && msLeft <= 10 * 60 * 1000 && msLeft > 0) {
            patch.notified10 = true;
            notify("Trackit", `10 minutes left to deliver "${t.name}"`, {
              silent: t.priority === "low",
              persistent: t.priority === "high",
            });
            if (t.priority === "high") vibrate([200, 100, 200]);
            else if (t.priority === "medium") vibrate(200);
          }
          if (!t.notifiedDue && msLeft <= 0 && msLeft > -60 * 1000) {
            patch.notifiedDue = true;
            // High → UrgentOverlay handles vibration + alarm visually
            if (t.priority === "medium") {
              notify("Trackit", `"${t.name}" is due now`, { persistent: true });
              vibrate(400);
            } else if (t.priority === "low") {
              notify("Trackit", `"${t.name}" is due`, { silent: true });
            }
          }
          if (Object.keys(patch).length) {
            changed = true;
            return { ...t, ...patch };
          }
          return t;
        });
        if (changed) save(tasksKey, next);
        return next;
      });
      if (toFire.size) {
        const updated: RoutineFires = {
          date: today,
          fires: { ...fires.fires },
        };
        const nowIso = new Date().toISOString();
        for (const [id, info] of toFire) {
          updated.fires[id] = nowIso;
          notify("Trackit", `${info.label2} — time to check in`, { persistent: true });
        }
        saveFiresForUser(updated);
        setRoutineFires(updated);
      }
      force((x) => x + 1);
    };
    tick();
    const i = setInterval(tick, 15000);
    return () => clearInterval(i);
  }, []);

  const persistTasks = (next: Task[]) => {
    setTasks(next);
    save(tasksKey, next);
  };
  const persistTemplates = (next: Template[]) => {
    setTemplates(next);
    save(templatesKey, next);
  };
  const persistFires = (next: RoutineFires) => {
    setRoutineFires(next);
    saveFiresForUser(next);
  };

  const addTask = useCallback(
    (input: {
      name: string;
      time: string;
      recurrence: Recurrence;
      customDays?: number[];
      urgent: boolean;
      priority?: Priority;
      trigger?: TriggerType;
      routineKey?: string;
      routineLabel?: string;
      routineTime?: string;
    }) => {
      const trigger = input.trigger ?? "time";
      const priority: Priority =
        input.priority ?? (input.urgent ? "high" : "medium");
      const due = new Date();
      if (trigger === "time") {
        const [h, m] = input.time.split(":").map(Number);
        due.setHours(h, m, 0, 0);
      } else {
        // Routine tasks: due at end of today so they don't surface as overdue
        due.setHours(23, 59, 0, 0);
      }
      const id = crypto.randomUUID();
      let templateId: string | undefined;
      if (input.recurrence !== "none") {
        const tmpl: Template = {
          id: crypto.randomUUID(),
          name: input.name,
          time: input.time,
          recurrence: input.recurrence,
          customDays: input.customDays,
          urgent: priority === "high" && input.urgent,
          createdAt: new Date().toISOString(),
          lastGenerated: todayISO(),
        };
        persistTemplates([...templates, tmpl]);
        templateId = tmpl.id;
      }
      const task: Task = {
        id,
        name: input.name,
        due: due.toISOString(),
        recurrence: input.recurrence,
        customDays: input.customDays,
        urgent: priority === "high" && input.urgent,
        priority,
        trigger,
        routineKey: trigger === "routine" ? input.routineKey : undefined,
        routineLabel: trigger === "routine" ? input.routineLabel : undefined,
        routineTime:
          trigger === "routine"
            ? input.routineTime ??
              (input.routineKey ? DEFAULT_ROUTINE_TIMES[input.routineKey] : undefined)
            : undefined,
        occurrenceDate: todayISO(),
        templateId,
        createdAt: new Date().toISOString(),
      };
      persistTasks([...tasks, task]);
      // Auto-confirm "Scheduled" stage 1s after creation
      setTimeout(() => {
        setTasks((prev) => {
          const next = prev.map((t) =>
            t.id === id && !t.startedAt
              ? { ...t, startedAt: new Date().toISOString() }
              : t,
          );
          save(tasksKey, next);
          return next;
        });
      }, 1000);
      // Request notification permission opportunistically
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        try { Notification.requestPermission().catch(() => {}); } catch { /* ignore */ }
      }
    },
    [tasks, templates],
  );

  const updateTask = useCallback(
    (id: string, patch: Partial<Task>) => {
      persistTasks(tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    },
    [tasks],
  );

  const startTask = (id: string) =>
    updateTask(id, { startedAt: new Date().toISOString() });

  const completeTask = (id: string) => {
    const now = new Date().toISOString();
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    persistTasks(
      tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              startedAt: t.startedAt ?? now,
              workingAt: t.workingAt ?? now,
              completedAt: now,
            }
          : t,
      ),
    );
    // streak update
    const s = load<{ count: number; lastDate: string }>(streakKey, {
      count: 0,
      lastDate: "",
    });
    const today = todayISO();
    if (s.lastDate !== today) {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
      const newCount = s.lastDate === yStr ? s.count + 1 : 1;
      save(streakKey, { count: newCount, lastDate: today });
    }
  };

  const removeTask = (id: string) => {
    const now = new Date().toISOString();
    persistTasks(
      tasks.map((t) => (t.id === id ? { ...t, deletedAt: now } : t)),
    );
  };

  // Hard-delete (used by auto-purge or manual "Forever delete")
  const purgeTask = (id: string) => {
    persistTasks(tasks.filter((t) => t.id !== id));
  };

  // Undo soft delete
  const restoreTask = (id: string) => {
    persistTasks(
      tasks.map((t) => (t.id === id ? { ...t, deletedAt: undefined } : t)),
    );
  };

  // Fire a routine — moves all matching incomplete routine tasks into the
  // "In Progress" stage so the user sees them as immediate nudges.
  const fireRoutine = useCallback(
    (matcher: { key?: string; label?: string }, opts: { silent?: boolean } = {}) => {
      const id = routineId(matcher);
      if (!id) return 0;
      const fires = loadFiresForUser();
      if (fires.fires[id]) return 0; // already checked in today
      const now = new Date().toISOString();
      const today = todayISO();
      let count = 0;
      const next = tasks.map((t) => {
        if (t.completedAt) return t;
        if (t.trigger !== "routine") return t;
        if (t.occurrenceDate !== today) return t;
        const matches =
          (matcher.key && t.routineKey === matcher.key) ||
          (matcher.label &&
            t.routineLabel?.toLowerCase() === matcher.label.toLowerCase());
        if (!matches) return t;
        count++;
        return {
          ...t,
          startedAt: t.startedAt ?? now,
          workingAt: now,
          // Bring deadline close so progress fills meaningfully
          due: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        };
      });
      persistTasks(next);
      const updatedFires = { ...fires, fires: { ...fires.fires, [id]: now } };
      persistFires(updatedFires);
      if (count > 0 && !opts.silent) {
        const label =
          matcher.label ??
          (matcher.key ? ROUTINES.find((r) => r.key === matcher.key)?.label : undefined) ??
          "Routine";
        notify("Trackit", `${label} — ${count} task${count === 1 ? "" : "s"} ready`, {
          persistent: true,
        });
      }
      return count;
    },
    [tasks],
  );

  return {
    tasks,
    templates,
    addTask,
    updateTask,
    startTask,
    completeTask,
    removeTask,
    purgeTask,
    restoreTask,
    fireRoutine,
    routineFires: routineFires.fires,
  };
};

export const getStreak = async (): Promise<number> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const key = scopedKey(STREAK_KEY, user?.id ?? null);
  const s = load<{ count: number; lastDate: string }>(key, {
    count: 0,
    lastDate: "",
  });
  return s.count;
};

export type Stage = 0 | 1 | 2 | 3;
export const taskStage = (t: Task): Stage => {
  if (t.completedAt) return 3;
  if (t.workingAt) return 2;
  if (t.startedAt) return 1;
  return 0;
};

export const isOverdue = (t: Task) =>
  !t.completedAt && new Date(t.due).getTime() < Date.now();

export const overdueMs = (t: Task) =>
  Math.max(0, Date.now() - new Date(t.due).getTime());

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export const formatOverdue = (ms: number) => {
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m} min overdue`;
  const h = Math.floor(m / 60);
  return `${h} hr${h > 1 ? "s" : ""} overdue`;
};

// Time-based progress percentage. Fills linearly from createdAt to due.
// 100% when completed; 100% (capped) at deadline.
export const progressPercent = (t: Task): number => {
  if (t.completedAt) return 100;
  const due = new Date(t.due).getTime();
  const start = t.createdAt ? new Date(t.createdAt).getTime() : due - 60 * 60 * 1000;
  const total = Math.max(1, due - start);
  const elapsed = Date.now() - start;
  const pct = Math.round((elapsed / total) * 100);
  return Math.max(0, Math.min(100, pct));
};