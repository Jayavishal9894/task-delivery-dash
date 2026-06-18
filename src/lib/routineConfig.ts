import { useCallback, useEffect, useState } from "react";
import {
  ROUTINES,
  DEFAULT_ROUTINE_TIMES,
  todayISO,
  type RoutineDef,
} from "./tasks";

export type RoutineConfig = {
  // Stable id; for built-ins this equals the key from ROUTINES.
  id: string;
  // For built-ins, the routine key; undefined for custom routines.
  key?: string;
  label: string;
  // HH:MM 24h approximate trigger time
  time: string;
  icon: RoutineDef["icon"];
  custom?: boolean;
  // Per-date enable override. Missing date => default true.
  enabledByDate?: Record<string, boolean>;
};

const KEY = "trackit.routineConfigs.v1";

const defaults = (): RoutineConfig[] =>
  ROUTINES.map((r) => ({
    id: r.key,
    key: r.key,
    label: r.label,
    time: DEFAULT_ROUTINE_TIMES[r.key] ?? "09:00",
    icon: r.icon,
  }));

const load = (): RoutineConfig[] => {
  if (typeof window === "undefined") return defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw) as RoutineConfig[];
    if (!Array.isArray(parsed) || parsed.length === 0) return defaults();
    // Heal: ensure every built-in still appears
    const byId = new Map(parsed.map((c) => [c.id, c] as const));
    for (const d of defaults()) if (!byId.has(d.id)) parsed.push(d);
    return parsed;
  } catch {
    return defaults();
  }
};

const save = (cfgs: RoutineConfig[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(cfgs));
};

export const isEnabledToday = (c: RoutineConfig, date = todayISO()) =>
  c.enabledByDate?.[date] !== false;

export const useRoutineConfigs = () => {
  const [configs, setConfigs] = useState<RoutineConfig[]>([]);

  useEffect(() => {
    setConfigs(load());
  }, []);

  const persist = (next: RoutineConfig[]) => {
    setConfigs(next);
    save(next);
  };

  const updateConfig = useCallback(
    (id: string, patch: Partial<RoutineConfig>) => {
      setConfigs((prev) => {
        const next = prev.map((c) => (c.id === id ? { ...c, ...patch } : c));
        save(next);
        return next;
      });
    },
    [],
  );

  const toggleToday = useCallback((id: string) => {
    const date = todayISO();
    setConfigs((prev) => {
      const next = prev.map((c) => {
        if (c.id !== id) return c;
        const cur = c.enabledByDate?.[date] !== false;
        return {
          ...c,
          enabledByDate: { ...(c.enabledByDate ?? {}), [date]: !cur },
        };
      });
      save(next);
      return next;
    });
  }, []);

  const addCustom = useCallback((label: string, time: string) => {
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const cfg: RoutineConfig = {
      id,
      label: label.trim() || "My routine",
      time,
      icon: "Star",
      custom: true,
    };
    setConfigs((prev) => {
      const next = [...prev, cfg];
      save(next);
      return next;
    });
    return cfg;
  }, []);

  const removeCustom = useCallback((id: string) => {
    setConfigs((prev) => {
      const next = prev.filter((c) => !(c.id === id && c.custom));
      save(next);
      return next;
    });
  }, []);

  return { configs, updateConfig, toggleToday, addCustom, removeCustom, persist };
};