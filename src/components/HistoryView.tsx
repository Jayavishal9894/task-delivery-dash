import { useMemo, useState } from "react";
import { ChevronDown, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { HistoryTaskRow, HistoryKind } from "./HistoryTaskRow";
import { DailyReport } from "./DailyReport";
import { Task, todayISO, getStreak } from "@/lib/tasks";
import { cn } from "@/lib/utils";

const yesterdayISO = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const friendlyDate = (iso: string) => {
  if (iso === todayISO()) return "Today";
  if (iso === yesterdayISO()) return "Yesterday";
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString([], { month: "long", day: "numeric" });
};

function groupByDate(tasks: Task[], pick: (t: Task) => string | undefined) {
  const groups = new Map<string, Task[]>();
  for (const t of tasks) {
    const ref = pick(t);
    if (!ref) continue;
    const iso = ref.slice(0, 10);
    const arr = groups.get(iso) ?? [];
    arr.push(t);
    groups.set(iso, arr);
  }
  return [...groups.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

export function HistoryView({
  tasks,
  onRedeliver,
  onRestore,
  onPurge,
}: {
  tasks: Task[];
  onRedeliver: (t: Task) => void;
  onRestore: (id: string) => void;
  onPurge: (id: string) => void;
}) {
  const today = todayISO();

  const completed = useMemo(
    () => tasks.filter((t) => t.completedAt && !t.deletedAt),
    [tasks],
  );
  const failed = useMemo(
    () =>
      tasks.filter(
        (t) =>
          !t.completedAt &&
          !t.deletedAt &&
          t.occurrenceDate < today, // past day, never delivered
      ),
    [tasks, today],
  );
  const deleted = useMemo(() => tasks.filter((t) => t.deletedAt), [tasks]);

  const yesterdaysTasks = useMemo(() => {
    const y = yesterdayISO();
    return tasks.filter((t) => t.occurrenceDate === y && !t.deletedAt);
  }, [tasks]);

  return (
    <div className="space-y-5">
      {yesterdaysTasks.length > 0 && (
        <DailyReport
          tasks={yesterdaysTasks}
          dateISO={yesterdayISO()}
          streak={getStreak()}
        />
      )}

      <Section
        label="Completed"
        count={completed.length}
        Icon={CheckCircle2}
        tone="emerald"
        defaultOpen
      >
        <Groups
          groups={groupByDate(completed, (t) => t.completedAt)}
          kind="completed"
          onRedeliver={onRedeliver}
        />
      </Section>

      <Section
        label="Delayed & Failed"
        count={failed.length}
        Icon={AlertCircle}
        tone="red"
      >
        <Groups
          groups={groupByDate(failed, (t) => `${t.occurrenceDate}T23:59:00`)}
          kind="failed"
          onRedeliver={onRedeliver}
        />
      </Section>

      <Section
        label="Deleted"
        count={deleted.length}
        Icon={Trash2}
        tone="slate"
      >
        <Groups
          groups={groupByDate(deleted, (t) => t.deletedAt)}
          kind="deleted"
          onRedeliver={onRedeliver}
          onRestore={onRestore}
          onPurge={onPurge}
        />
      </Section>
    </div>
  );
}

function Section({
  label,
  count,
  Icon,
  tone,
  defaultOpen,
  children,
}: {
  label: string;
  count: number;
  Icon: React.ComponentType<{ className?: string }>;
  tone: "emerald" | "red" | "slate";
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const toneClass =
    tone === "emerald"
      ? "text-emerald-600"
      : tone === "red"
        ? "text-red-600"
        : "text-slate-500";
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between bg-card border rounded-xl px-4 py-3 shadow-sm"
        >
          <div className="flex items-center gap-2.5">
            <Icon className={cn("h-4 w-4", toneClass)} />
            <span className="font-semibold text-sm">{label}</span>
            <span className="text-xs text-muted-foreground">({count})</span>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3 space-y-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function Groups({
  groups,
  kind,
  onRedeliver,
  onRestore,
  onPurge,
}: {
  groups: [string, Task[]][];
  kind: HistoryKind;
  onRedeliver: (t: Task) => void;
  onRestore?: (id: string) => void;
  onPurge?: (id: string) => void;
}) {
  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        Nothing here yet.
      </p>
    );
  }
  return (
    <>
      {groups.map(([iso, list]) => (
        <div key={iso} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
            {friendlyDate(iso)}
          </h3>
          <div className="space-y-2">
            {list.map((t) => (
              <HistoryTaskRow
                key={t.id}
                task={t}
                kind={kind}
                onRedeliver={() => onRedeliver(t)}
                onRestore={onRestore ? () => onRestore(t.id) : undefined}
                onPurge={onPurge ? () => onPurge(t.id) : undefined}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}