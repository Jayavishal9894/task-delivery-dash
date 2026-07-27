import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { MemberRow } from "@/lib/team";

function defaultDue() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AssignTaskDialog({
  workspaceId,
  managerId,
  members,
  onCreated,
}: {
  workspaceId: string;
  managerId: string;
  members: MemberRow[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [due, setDue] = useState(defaultDue());
  const [assignee, setAssignee] = useState(managerId);
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Give the task a name");
    if (!assignee) return toast.error("Pick who this is for");
    setBusy(true);
    const { error } = await supabase.from("team_tasks").insert({
      workspace_id: workspaceId,
      name: name.trim().slice(0, 200),
      description: description.trim() || null,
      due_at: new Date(due).toISOString(),
      priority,
      urgent: priority === "high",
      created_by: managerId,
      assigned_to: assignee,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Task dispatched", { description: name.trim() });
    setName("");
    setDescription("");
    setDue(defaultDue());
    setOpen(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full h-12 rounded-2xl text-base font-semibold">
          <Plus className="h-5 w-5 mr-1" /> Assign a task
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign a task</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tname">Task</Label>
            <Input
              id="tname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Send the client proposal"
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tdesc">Details (optional)</Label>
            <Textarea
              id="tdesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={1000}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tassignee">Assign to</Label>
            <select
              id="tassignee"
              className="w-full h-10 rounded-lg border bg-background px-2 text-sm"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            >
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.display_name || m.email}
                  {m.user_id === managerId ? " (you)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tdue">Due</Label>
              <Input
                id="tdue"
                type="datetime-local"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tprio">Priority</Label>
              <select
                id="tprio"
                className="w-full h-10 rounded-lg border bg-background px-2 text-sm"
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as "low" | "medium" | "high")
                }
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <Button type="submit" className="w-full h-11" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Dispatch task
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}