import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AssignTaskDialog } from "@/components/team/AssignTaskDialog";
import { InviteMemberDialog } from "@/components/team/InviteMemberDialog";
import { JoinGroupDialog } from "@/components/team/JoinGroupDialog";
import { TeamShell } from "@/components/team/TeamShell";
import { TeamTaskCard } from "@/components/team/TeamTaskCard";
import {
  createWorkspace,
  teamStage,
  useCurrentUser,
  useMembers,
  useMemberships,
  useTeamTasks,
} from "@/lib/team";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team dashboard — Trackit" },
      {
        name: "description",
        content:
          "Assign tasks to your team and watch every delivery move from created to delivered in real time.",
      },
      { property: "og:title", content: "Team dashboard — Trackit" },
      {
        property: "og:description",
        content: "Assign tasks and track every team delivery live.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeamPage,
});

type Filter = "all" | "active" | "review" | "delayed" | "delivered";

function TeamPage() {
  const { user } = useCurrentUser();
  const { memberships, active, setActive, loading, refresh } = useMemberships();
  const workspaceId = active?.workspace.id ?? null;
  const { members, refresh: refreshMembers } = useMembers(workspaceId);
  const {
    tasks,
    advance,
    submitForReview,
    reviewTask,
    remove,
    refresh: refreshTasks,
  } = useTeamTasks(workspaceId);

  const [filter, setFilter] = useState<Filter>("all");
  const [assignee, setAssignee] = useState<string>("all");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const nameOf = (id: string) => {
    const m = members.find((x) => x.user_id === id);
    return m?.display_name || m?.email || "Teammate";
  };

  const visible = useMemo(() => {
    const now = Date.now();
    return tasks.filter((t) => {
      if (assignee !== "all" && t.assigned_to !== assignee) return false;
      const stage = teamStage(t);
      if (filter === "delivered") return stage === 4;
      if (filter === "review") return stage === 3;
      if (filter === "active") return stage < 3;
      if (filter === "delayed")
        return stage < 4 && new Date(t.due_at).getTime() < now;
      return true;
    });
  }, [tasks, filter, assignee]);

  const delivered = tasks.filter((t) => teamStage(t) === 4).length;
  const inReview = tasks.filter((t) => teamStage(t) === 3).length;
  const delayed = tasks.filter(
    (t) => teamStage(t) < 4 && new Date(t.due_at).getTime() < Date.now(),
  ).length;

  const makeWorkspace = async () => {
    if (!user || !newName.trim()) return;
    setCreating(true);
    try {
      await createWorkspace(newName.trim().slice(0, 80), user.id);
      setNewName("");
      await refresh();
      toast.success("Group created — you're the admin");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create workspace");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!active) {
    return (
      <TeamShell memberships={[]} active={null} onSelect={() => {}}>
        <div className="bg-card border rounded-2xl p-6 shadow-sm text-center">
          <Users className="h-8 w-8 text-primary mx-auto mb-3" />
          <h1 className="text-xl font-bold">Create your group</h1>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            You'll be the admin — invite members with a code or email and
            start assigning deliveries.
          </p>
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Acme Ops"
              maxLength={80}
            />
            <Button onClick={makeWorkspace} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </div>
          <div className="flex items-center gap-3 my-4">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <JoinGroupDialog onJoined={() => void refresh()} />
        </div>
      </TeamShell>
    );
  }

  const isManager = active.role === "manager";

  return (
    <TeamShell memberships={memberships} active={active} onSelect={setActive}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold leading-tight">
            {active.workspace.name}
          </h1>
          <p className="text-xs text-muted-foreground capitalize">
            You're the {active.role === "manager" ? "admin" : "member"} ·{" "}
            {members.length} member
            {members.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <JoinGroupDialog onJoined={() => void refresh()} />
          {isManager && user && (
            <InviteMemberDialog
              workspaceId={active.workspace.id}
              inviteCode={active.workspace.invite_code}
              managerId={user.id}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4">
        <Stat label="Total" value={tasks.length} />
        <Stat label="In review" value={inReview} tone="text-amber-600" />
        <Stat label="Delivered" value={delivered} tone="text-primary" />
        <Stat label="Delayed" value={delayed} tone="text-red-500" />
      </div>

      {isManager && user && (
        <div className="mb-4">
          <AssignTaskDialog
            workspaceId={active.workspace.id}
            managerId={user.id}
            members={members}
            onCreated={() => {
              void refreshTasks();
              void refreshMembers();
            }}
          />
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {(["all", "active", "review", "delayed", "delivered"] as Filter[]).map(
          (f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium capitalize",
              filter === f
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card hover:bg-muted/50",
            )}
          >
            {f === "review" ? "In review" : f}
          </button>
          ),
        )}
        {isManager && members.length > 1 && (
          <select
            aria-label="Filter by assignee"
            className="h-9 rounded-full border bg-card px-3 text-sm"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
          >
            <option value="all">Everyone</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.display_name || m.email}
              </option>
            ))}
          </select>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">📦</div>
          <p className="text-muted-foreground">
            {isManager
              ? "No tasks here yet. Assign one to get the belt moving."
              : "Nothing assigned to you in this group yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((t) => (
            <TeamTaskCard
              key={t.id}
              task={t}
              assigneeName={nameOf(t.assigned_to)}
              canDelete={isManager}
              isAssignee={t.assigned_to === user?.id}
              canReview={isManager}
              onAdvance={(to) => advance(t, to)}
              onSubmitProof={(proof) => submitForReview(t, proof)}
              onReview={(approve, comment) =>
                user
                  ? reviewTask(t, approve, comment, user.id)
                  : Promise.resolve()
              }
              onDelete={() => remove(t.id)}
            />
          ))}
        </div>
      )}
    </TeamShell>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="bg-card border rounded-2xl p-3 text-center shadow-sm">
      <div className={cn("text-2xl font-bold", tone)}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
        {label}
      </div>
    </div>
  );
}