import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Package, User, Users } from "lucide-react";
import { toast } from "sonner";
import { joinWorkspaceByCode } from "@/lib/team";

export const Route = createFileRoute("/_authenticated/choose")({
  validateSearch: (search: Record<string, unknown>) => ({
    join: typeof search.join === "string" ? search.join : undefined,
  }),
  head: () => ({
    meta: [
      { title: "How do you want to use Trackit?" },
      {
        name: "description",
        content:
          "Pick Personal mode for your own tasks, or Team mode to assign, track and verify group deliveries.",
      },
      { property: "og:title", content: "Choose your Trackit mode" },
      {
        property: "og:description",
        content: "Personal tasks, team tasks — or both.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChoosePage,
});

function ChoosePage() {
  const { join } = Route.useSearch();
  const navigate = useNavigate();
  const [joining, setJoining] = useState(Boolean(join));

  useEffect(() => {
    if (!join) return;
    joinWorkspaceByCode(join)
      .then(() => {
        toast.success("You've joined the group");
        navigate({ to: "/team", replace: true });
      })
      .catch(() => {
        toast.error("That invite code doesn't match any group");
        setJoining(false);
      });
  }, [join, navigate]);

  if (joining) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <header className="px-4 py-4 flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
          <Package className="h-4 w-4" />
        </div>
        <span className="font-bold text-lg">Trackit</span>
      </header>
      <main className="flex-1 flex items-start justify-center px-4 pt-8 pb-16">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-bold tracking-tight text-center">
            How do you want to use Trackit?
          </h1>
          <p className="text-sm text-muted-foreground text-center mt-1 mb-6">
            You can use both — switch anytime from the bottom bar.
          </p>
          <div className="space-y-3">
            <Link
              to="/app"
              className="block bg-card border rounded-2xl p-5 shadow-sm hover:border-primary transition-colors"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <User className="h-5 w-5" />
                </div>
                <h2 className="font-bold text-lg">Personal</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Your own to-do list with the delivery tracker, urgent alerts
                and routine reminders — just for you, works offline.
              </p>
            </Link>
            <Link
              to="/team"
              className="block bg-card border rounded-2xl p-5 shadow-sm hover:border-primary transition-colors"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Users className="h-5 w-5" />
                </div>
                <h2 className="font-bold text-lg">Team</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Create or join a group. Admins assign tasks, members submit
                proof, and every delivery is reviewed before it counts.
              </p>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}