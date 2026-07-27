import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { Stage } from "@/lib/tasks";

export type WorkspaceRole = "manager" | "member";
export type TeamTask = Tables<"team_tasks">;
export type Workspace = Tables<"workspaces">;
export type Profile = Tables<"profiles">;

export type Membership = {
  workspace: Workspace;
  role: WorkspaceRole;
};

export type MemberRow = {
  user_id: string;
  role: WorkspaceRole;
  email: string;
  display_name: string | null;
};

export const teamStage = (t: TeamTask): Stage => {
  if (t.completed_at) return 3;
  if (t.working_at) return 2;
  if (t.started_at) return 1;
  return 0;
};

export const teamOverdue = (t: TeamTask) =>
  !t.completed_at && new Date(t.due_at).getTime() < Date.now();

export const teamProgress = (t: TeamTask): number => {
  if (t.completed_at) return 100;
  const due = new Date(t.due_at).getTime();
  const start = new Date(t.created_at).getTime();
  const total = Math.max(1, due - start);
  const pct = Math.round(((Date.now() - start) / total) * 100);
  return Math.max(0, Math.min(100, pct));
};

/** Current signed-in user id + email. */
export function useCurrentUser() {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      setUser(
        data.user ? { id: data.user.id, email: data.user.email ?? "" } : null,
      );
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  return { user, loading };
}

/** Workspaces the user belongs to, plus the active one. */
export function useMemberships() {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("workspace_members")
      .select("role, workspaces(*)")
      .order("created_at", { ascending: true });
    if (error) {
      setLoading(false);
      return;
    }
    const rows: Membership[] = (data ?? [])
      .filter((r) => r.workspaces)
      .map((r) => ({
        role: r.role as WorkspaceRole,
        workspace: r.workspaces as Workspace,
      }));
    setMemberships(rows);
    setActiveId((prev) => {
      if (prev && rows.some((r) => r.workspace.id === prev)) return prev;
      const stored =
        typeof localStorage !== "undefined"
          ? localStorage.getItem("trackit.workspace")
          : null;
      if (stored && rows.some((r) => r.workspace.id === stored)) return stored;
      return rows[0]?.workspace.id ?? null;
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setActive = useCallback((id: string) => {
    setActiveId(id);
    try {
      localStorage.setItem("trackit.workspace", id);
    } catch {
      /* ignore */
    }
  }, []);

  const active = memberships.find((m) => m.workspace.id === activeId) ?? null;
  return { memberships, active, setActive, loading, refresh };
}

export async function createWorkspace(name: string, userId: string) {
  const { data, error } = await supabase
    .from("workspaces")
    .insert({ name, owner_id: userId })
    .select()
    .single();
  if (error) throw error;
  const { error: mErr } = await supabase
    .from("workspace_members")
    .insert({ workspace_id: data.id, user_id: userId, role: "manager" });
  if (mErr) throw mErr;
  return data;
}

/** Members of a workspace, joined with their profile. */
export function useMembers(workspaceId: string | null) {
  const [members, setMembers] = useState<MemberRow[]>([]);

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setMembers([]);
      return;
    }
    const { data } = await supabase
      .from("workspace_members")
      .select("user_id, role, profiles:user_id(email, display_name)")
      .eq("workspace_id", workspaceId);
    setMembers(
      (data ?? []).map((r) => {
        const p = r.profiles as unknown as {
          email: string;
          display_name: string | null;
        } | null;
        return {
          user_id: r.user_id,
          role: r.role as WorkspaceRole,
          email: p?.email ?? "",
          display_name: p?.display_name ?? null,
        };
      }),
    );
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { members, refresh };
}

/** Live team tasks for a workspace (RLS decides what you can see). */
export function useTeamTasks(workspaceId: string | null) {
  const [tasks, setTasks] = useState<TeamTask[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setTasks([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("team_tasks")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("due_at", { ascending: true });
    setTasks(data ?? []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  // Realtime: any change in this workspace refetches through RLS.
  useEffect(() => {
    if (!workspaceId) return;
    const channel = supabase
      .channel(`team_tasks:${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "team_tasks",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [workspaceId, refresh]);

  const advance = useCallback(
    async (t: TeamTask, to: 1 | 2 | 3) => {
      const patch: Partial<TeamTask> = {};
      const now = new Date().toISOString();
      if (to >= 1 && !t.started_at) patch.started_at = now;
      if (to >= 2 && !t.working_at) patch.working_at = now;
      if (to === 3) patch.completed_at = now;
      await supabase.from("team_tasks").update(patch).eq("id", t.id);
      void refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await supabase.from("team_tasks").delete().eq("id", id);
      void refresh();
    },
    [refresh],
  );

  return { tasks, loading, refresh, advance, remove };
}