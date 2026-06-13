import { useEffect, useState, useCallback } from "react";

export type Recurrence = "none" | "daily" | "weekly" | "custom";

export type Task = {
  id: string;
  name: string;
  // ISO datetime for due
  due: string;
  recurrence: Recurrence;
  // 0-6 (Sun-Sat) for custom/weekly
  customDays?: number[];
  urgent: boolean;
  // ISO date (YYYY-MM-DD) for the occurrence this task represents
  occurrenceDate: string;
  startedAt?: string;
  workingAt?: string;
  completedAt?: string;
  // Template id this occurrence was generated from (for recurring)
  templateId?: string;
  urgentDismissed?: boolean;
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
      occurrenceDate: today,
      templateId: t.id,
    });
  }
  return newTasks;
};

export const useTaskStore = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [, force] = useState(0);

  useEffect(() => {
    const loaded = load<Task[]>(TASKS_KEY, []);
    const tmpls = load<Template[]>(TEMPLATES_KEY, []);
    const generated = generateRecurringForToday(tmpls, loaded);
    const merged = [...loaded, ...generated];
    if (generated.length) save(TASKS_KEY, merged);
    setTasks(merged);
    setTemplates(tmpls);
  }, []);

  // tick every 30s so UI re-evaluates overdue/urgent
  useEffect(() => {
    const i = setInterval(() => force((x) => x + 1), 30000);
    return () => clearInterval(i);
  }, []);

  const persistTasks = (next: Task[]) => {
    setTasks(next);
    save(TASKS_KEY, next);
  };
  const persistTemplates = (next: Template[]) => {
    setTemplates(next);
    save(TEMPLATES_KEY, next);
  };

  const addTask = useCallback(
    (input: {
      name: string;
      time: string;
      recurrence: Recurrence;
      customDays?: number[];
      urgent: boolean;
    }) => {
      const [h, m] = input.time.split(":").map(Number);
      const due = new Date();
      due.setHours(h, m, 0, 0);
      const id = crypto.randomUUID();
      let templateId: string | undefined;
      if (input.recurrence !== "none") {
        const tmpl: Template = {
          id: crypto.randomUUID(),
          name: input.name,
          time: input.time,
          recurrence: input.recurrence,
          customDays: input.customDays,
          urgent: input.urgent,
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
        urgent: input.urgent,
        occurrenceDate: todayISO(),
        templateId,
      };
      persistTasks([...tasks, task]);
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
    const s = load<{ count: number; lastDate: string }>(STREAK_KEY, {
      count: 0,
      lastDate: "",
    });
    const today = todayISO();
    if (s.lastDate !== today) {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
      const newCount = s.lastDate === yStr ? s.count + 1 : 1;
      save(STREAK_KEY, { count: newCount, lastDate: today });
    }
  };

  const removeTask = (id: string) => {
    persistTasks(tasks.filter((t) => t.id !== id));
  };

  return {
    tasks,
    templates,
    addTask,
    updateTask,
    startTask,
    completeTask,
    removeTask,
  };
};

export const getStreak = (): number => {
  const s = load<{ count: number; lastDate: string }>(STREAK_KEY, {
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