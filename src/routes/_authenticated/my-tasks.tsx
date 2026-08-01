import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { TeamShell } from "@/components/team/TeamShell";
import { TeamTaskCard } from "@/components/team/TeamTaskCard";
import {
  teamStage,
  useCurrentUser,
  useMembers,
  useMemberships,
  useTeamTasks,
} from "@/lib/team";

export const Route = createFileRoute("/_authenticated/my-tasks")({
  head: () => ({
    meta: [
      { title: "My tasks — Trackit" },
      {
        name: "description",
        content:
          "Every task assigned to you, tracked like a package from created to delivered.",
      },
      { property: "og:title", content: "My tasks — Trackit" },
      {
        property: "og:description",
        content: "Every task assigned to you, tracked like a package.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyTasksPage,
});

function MyTasksPage() {
  const { user } = useCurrentUser();
  const { memberships, active, setActive, loading } = useMemberships();
  const workspaceId = active?.workspace.id ?? null;
  const { members } = useMembers(workspaceId);
  const { tasks, advance, submitForReview } = useTeamTasks(workspaceId);

  const mine = tasks.filter((t) => t.assigned_to === user?.id);
  const open = mine.filter((t) => teamStage(t) < 3);
  const inReview = mine.filter((t) => teamStage(t) === 3);
  const done = mine.filter((t) => teamStage(t) === 4);

  const nameOf = (id: string) => {
    const m = members.find((x) => x.user_id === id);
    return m?.display_name || m?.email || "You";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <TeamShell memberships={memberships} active={active} onSelect={setActive}>
      <h1 className="text-xl font-bold mb-1">My tasks</h1>
      <p className="text-xs text-muted-foreground mb-4">
        {open.length} out for delivery · {inReview.length} in review ·{" "}
        {done.length} completed
      </p>

      {mine.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">📦</div>
          <p className="text-muted-foreground">
            Nothing assigned to you yet. Enjoy the quiet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...open, ...inReview, ...done].map((t) => (
            <TeamTaskCard
              key={t.id}
              task={t}
              assigneeName={nameOf(t.assigned_to)}
              canDelete={false}
              isAssignee
              canReview={false}
              onAdvance={(to) => advance(t, to)}
              onSubmitProof={(proof) => submitForReview(t, proof)}
              onReview={() => Promise.resolve()}
              onDelete={() => {}}
            />
          ))}
        </div>
      )}
    </TeamShell>
  );
}