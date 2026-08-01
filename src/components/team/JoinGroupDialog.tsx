import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import { joinWorkspaceByCode } from "@/lib/team";

export function JoinGroupDialog({ onJoined }: { onJoined: () => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    try {
      await joinWorkspaceByCode(code.trim());
      toast.success("You've joined the group");
      setCode("");
      setOpen(false);
      onJoined();
    } catch (err) {
      toast.error(
        err instanceof Error && err.message.includes("Invalid invite code")
          ? "That code doesn't match any group"
          : "Couldn't join — check the code and try again",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <KeyRound className="h-4 w-4 mr-1" /> Join with code
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Join a group</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="join-code">Invite code</Label>
            <Input
              id="join-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. A1B2C3D4"
              maxLength={12}
              className="font-mono tracking-widest uppercase"
              autoComplete="off"
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Join group
          </Button>
          <p className="text-xs text-muted-foreground">
            Ask your group's admin for the code — you'll join as a member and
            only see tasks assigned to you.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}