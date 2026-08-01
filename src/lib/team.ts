import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

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

/** 0 Created · 1 Scheduled · 2 In Progress · 3 Pending Review · 4 Completed */
export type TeamStage = 0 | 1 | 2 | 3 | 4;

export const teamStage = (t: TeamTask): TeamStage => {
  if (t.completed_at) return 4;
  if (t.submitted_at && t.review_status === "pending") return 3;
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
    async (t: TeamTask, to: 1 | 2) => {
      const patch: Partial<TeamTask> = {};
      const now = new Date().toISOString();
      if (to >= 1 && !t.started_at) patch.started_at = now;
      if (to >= 2 && !t.working_at) patch.working_at = now;
      await supabase.from("team_tasks").update(patch).eq("id", t.id);
      void refresh();
    },
    [refresh],
  );

  /** Member submits proof → moves to Pending Review. */
  const submitForReview = useCallback(
    async (t: TeamTask, proof: { text?: string; photoPath?: string }) => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("team_tasks")
        .update({
          started_at: t.started_at ?? now,
          working_at: t.working_at ?? now,
          submitted_at: now,
          proof_text: proof.text?.trim() || null,
          proof_photo_path: proof.photoPath ?? null,
          review_status: "pending",
          review_comment: null,
        })
        .eq("id", t.id);
      if (error) throw error;
      void refresh();
    },
    [refresh],
  );

  /** Admin approves (→ Completed) or rejects (→ back to In Progress). */
  const reviewTask = useCallback(
    async (
      t: TeamTask,
      approve: boolean,
      comment: string | null,
      reviewerId: string,
    ) => {
      const now = new Date().toISOString();
      const patch: Partial<TeamTask> = approve
        ? {
            review_status: "approved",
            reviewed_by: reviewerId,
            reviewed_at: now,
            completed_at: now,
            review_comment: comment,
          }
        : {
            review_status: "rejected",
            reviewed_by: reviewerId,
            reviewed_at: now,
            review_comment: comment,
          };
      const { error } = await supabase
        .from("team_tasks")
        .update(patch)
        .eq("id", t.id);
      if (error) throw error;
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

  return { tasks, loading, refresh, advance, submitForReview, reviewTask, remove };
}

/** Upload a proof photo to the private task-proofs bucket. Returns its path. */
export async function uploadProofPhoto(
  taskId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${taskId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("task-proofs")
    .upload(path, file);
  if (error) throw error;
  return path;
}

/** Signed URL (1h) so group members and admins can view a proof photo. */
export async function proofPhotoUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("task-proofs")
    .createSignedUrl(path, 60 * 60);
  return error ? null : data.signedUrl;
}

/** Join a group by its invite code. Returns the workspace id. */
export async function joinWorkspaceByCode(code: string): Promise<string> {
  const { data, error } = await supabase.rpc("join_workspace_by_code", {
    _code: code,
  });
  if (error) throw error;
  return data as string;
}