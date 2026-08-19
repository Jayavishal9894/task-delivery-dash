import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, ListChecks, LogOut, Package, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { Membership } from "@/lib/team";

export function TeamShell({
  memberships,
  active,
  onSelect,
  children,
}: {
  memberships: Membership[];
  active: Membership | null;
  onSelect: (id: string) => void;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true, search: {} });
  };

  return (
    <div className="min-h-screen bg-muted/30 pb-24">
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link to="/app" className="flex items-center gap-2 shrink-0">
            <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <Package className="h-4 w-4" />
            </div>
            <span className="font-bold text-lg">Trackit</span>
          </Link>
          <div className="flex items-center gap-2">
            {memberships.length > 1 && (
              <select
                aria-label="Group"
                className="h-9 rounded-lg border bg-background px-2 text-sm max-w-[9rem]"
                value={active?.workspace.id ?? ""}
                onChange={(e) => onSelect(e.target.value)}
              >
                {memberships.map((m) => (
                  <option key={m.workspace.id} value={m.workspace.id}>
                    {m.workspace.name}
                  </option>
                ))}
              </select>
            )}
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-5">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t">
        <div className="max-w-2xl mx-auto grid grid-cols-3">
          <ShellTab to="/app" label="Personal" Icon={User} />
          <ShellTab to="/my-tasks" label="My tasks" Icon={ListChecks} />
          {active?.role === "manager" ? (
            <ShellTab to="/team" label="Team" Icon={LayoutDashboard} />
          ) : (
            <ShellTab to="/team" label="Group" Icon={LayoutDashboard} />
          )}
        </div>
      </nav>
    </div>
  );
}

function ShellTab({
  to,
  label,
  Icon,
}: {
  to: "/app" | "/my-tasks" | "/team";
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      activeProps={{ className: cn("text-primary") }}
    >
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
}