import { useEffect, useState } from "react";
import { Copy, KeyRound, Link2, Loader2, Mail, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import type { WorkspaceRole } from "@/lib/team";

const emailSchema = z.string().trim().email().max(320);

type Invite = {
  id: string;
  email: string;
  role: WorkspaceRole;
  accepted_at: string | null;
};

export function InviteMemberDialog({
  workspaceId,
  inviteCode,
  managerId,
}: {
  workspaceId: string;
  inviteCode: string;
  managerId: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("member");
  const [busy, setBusy] = useState(false);
  const [invites, setInvites] = useState<Invite[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("workspace_invites")
      .select("id, email, role, accepted_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    setInvites((data ?? []) as Invite[]);
  };

  useEffect(() => {
    if (open) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workspaceId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return toast.error("Enter a valid email address");
    setBusy(true);
    const { error } = await supabase.from("workspace_invites").upsert(
      {
        workspace_id: workspaceId,
        email: parsed.data.toLowerCase(),
        role,
        invited_by: managerId,
      },
      { onConflict: "workspace_id,email" },
    );
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Invite created", {
      description: `${parsed.data} joins as ${role} when they sign up.`,
    });
    setEmail("");
    void load();
  };

  const inviteLink = `${window.location.origin}/auth?join=${inviteCode}`;

  const copy = async (value: string, what: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${what} copied`);
    } catch {
      toast.error("Couldn't copy — long-press to copy manually");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="h-4 w-4 mr-1" /> Invite
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite to group</DialogTitle>
        </DialogHeader>
        <div className="rounded-xl border bg-muted/40 p-3 space-y-2">
          <div className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
            Invite code
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-lg font-bold tracking-[0.25em]">
              {inviteCode}
            </span>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void copy(inviteCode, "Code")}
              >
                <Copy className="h-3.5 w-3.5 mr-1" /> Code
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void copy(inviteLink, "Link")}
              >
                <Link2 className="h-3.5 w-3.5 mr-1" /> Link
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Anyone with the code or link joins as a member after signing in.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <KeyRound className="h-3 w-3" /> or invite by email
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="iemail">Email</Label>
            <Input
              id="iemail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@company.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="irole">Role</Label>
            <select
              id="irole"
              className="w-full h-10 rounded-lg border bg-background px-2 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value as WorkspaceRole)}
            >
              <option value="member">Member — sees only their tasks</option>
              <option value="manager">Manager — assigns and sees all</option>
            </select>
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Send invite
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">
          They join automatically the moment they create a Trackit account with
          this email.
        </p>
        {invites.length > 0 && (
          <div className="border-t pt-3 space-y-2 max-h-48 overflow-y-auto">
            {invites.map((i) => (
              <div
                key={i.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="inline-flex items-center gap-1.5 truncate">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  {i.email}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {i.accepted_at ? "Joined" : "Pending"} · {i.role}
                </span>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}