import { useState } from "react";
import { Camera, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { uploadProofPhoto } from "@/lib/team";

export function SubmitProofDialog({
  taskId,
  onSubmit,
}: {
  taskId: string;
  onSubmit: (proof: { text?: string; photoPath?: string }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !file)
      return toast.error("Add a note or a photo as proof");
    setBusy(true);
    try {
      let photoPath: string | undefined;
      if (file) photoPath = await uploadProofPhoto(taskId, file);
      await onSubmit({ text: text.trim() || undefined, photoPath });
      toast.success("Sent for review", {
        description: "Your admin will approve or send it back.",
      });
      setText("");
      setFile(null);
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex-1">
          <Send className="h-4 w-4 mr-1" /> Submit for review
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Submit proof of completion</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="proof-note">Note</Label>
            <Textarea
              id="proof-note"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What did you deliver? Where can it be checked?"
              rows={3}
              maxLength={1000}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proof-photo">Photo (optional)</Label>
            <label
              htmlFor="proof-photo"
              className="flex items-center gap-2 rounded-xl border border-dashed px-3 py-3 text-sm text-muted-foreground cursor-pointer hover:bg-muted/40"
            >
              <Camera className="h-4 w-4" />
              {file ? file.name : "Attach a photo as proof"}
            </label>
            <input
              id="proof-photo"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (f && f.size > 5 * 1024 * 1024) {
                  toast.error("Photo must be under 5 MB");
                  return;
                }
                setFile(f);
              }}
            />
          </div>
          <Button type="submit" className="w-full h-11" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Send to admin for review
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}