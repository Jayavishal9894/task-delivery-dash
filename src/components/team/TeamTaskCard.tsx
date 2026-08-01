import { useEffect, useState } from "react";
import { Check, Clock, Trash2, UserRound, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { TeamTracker } from "@/components/team/TeamTracker";
import { SubmitProofDialog } from "@/components/team/SubmitProofDialog";
import { cn } from "@/lib/utils";
import {
  proofPhotoUrl,
  teamOverdue,
  teamProgress,
  teamStage,
  type TeamTask,
} from "@/lib/team";

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-50 text-red-600 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-muted text-muted-foreground border-border",
};

export function TeamTaskCard({
  task,
  assigneeName,
  canDelete,
  isAssignee,
  canReview,
  onAdvance,
  onSubmitProof,
  onReview,
  onDelete,
}: {
  task: TeamTask;
  assigneeName: string;
  canDelete: boolean;
  isAssignee: boolean;
  canReview: boolean;
  onAdvance: (to: 1 | 2) => void | Promise<void>;
  onSubmitProof: (proof: { text?: string; photoPath?: string }) => Promise<void>;
  onReview: (approve: boolean, comment: string | null) => Promise<void>;
  onDelete: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const stage = teamStage(task);
  const overdue = teamOverdue(task);
  const pct = teamProgress(task);

  useEffect(() => {
    let alive = true;
    if (task.proof_photo_path) {
      proofPhotoUrl(task.proof_photo_path).then((u) => {
        if (alive) setPhotoUrl(u);
      });
    } else {
      setPhotoUrl(null);
    }
    return () => {
      alive = false;
    };
  }, [task.proof_photo_path]);

  const run = async (fn: () => void | Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    await run(() => onReview(false, comment.trim() || null));
    setComment("");
    setRejectOpen(false);
  };

  return (
    <div
      className={cn(
        "bg-card border rounded-2xl p-4 shadow-sm",
        overdue && "border-red-300",
        stage === 4 && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3
            className={cn(
              "font-semibold leading-tight",
              stage === 4 && "line-through text-muted-foreground",
            )}
          >
            {task.name}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <UserRound className="h-3.5 w-3.5" />
              {assigneeName}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {new Date(task.due_at).toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 font-medium capitalize",
                PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.low,
              )}
            >
              {task.priority}
            </span>
            {overdue && (
              <span className="rounded-full bg-red-500 text-white px-2 py-0.5 font-semibold">
                Delayed
              </span>
            )}
            {stage === 3 && (
              <span className="rounded-full bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 font-semibold">
                In review
              </span>
            )}
            {task.review_status === "rejected" && stage === 2 && (
              <span className="rounded-full bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 font-semibold">
                Sent back
              </span>
            )}
          </div>
        </div>
        {canDelete && (
          <button
            type="button"
            aria-label="Delete task"
            onClick={onDelete}
            className="text-muted-foreground hover:text-red-500 shrink-0"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {task.description && (
        <p className="text-sm text-muted-foreground mb-3">{task.description}</p>
      )}

      <TeamTracker stage={stage} overdue={overdue} />

      <div className="mt-3 flex items-center gap-3">
        <Progress value={pct} className="h-2 flex-1" />
        <span className="text-xs font-semibold text-muted-foreground">
          {pct}%
        </span>
      </div>

      {(task.proof_text || photoUrl) && (
        <div className="mt-3 rounded-xl border bg-muted/40 p-3">
          <div className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-1">
            Proof submitted
          </div>
          {task.proof_text && <p className="text-sm">{task.proof_text}</p>}
          {photoUrl && (
            <a href={photoUrl} target="_blank" rel="noreferrer">
              <img
                src={photoUrl}
                alt="Proof of completion"
                className="mt-2 h-24 w-24 rounded-lg object-cover border"
              />
            </a>
          )}
        </div>
      )}

      {task.review_status === "rejected" && task.review_comment && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <span className="font-semibold">Admin note:</span>{" "}
          {task.review_comment}
        </div>
      )}

      {(isAssignee || canReview) && stage < 4 && (
        <div className="mt-3 flex gap-2">
          {isAssignee && stage < 2 && (
            <Button
              variant="outline"
              className="flex-1"
              disabled={busy}
              onClick={() => run(() => onAdvance(2))}
            >
              <Zap className="h-4 w-4 mr-1" /> Start working
            </Button>
          )}
          {isAssignee && stage === 2 && (
            <SubmitProofDialog
              taskId={task.id}
              onSubmit={onSubmitProof}
            />
          )}
          {canReview && stage === 3 && (
            <>
              <Button
                variant="outline"
                className="flex-1"
                disabled={busy}
                onClick={() => setRejectOpen(true)}
              >
                <X className="h-4 w-4 mr-1" /> Reject
              </Button>
              <Button
                className="flex-1"
                disabled={busy}
                onClick={() => run(() => onReview(true, null))}
              >
                <Check className="h-4 w-4 mr-1" /> Approve
              </Button>
            </>
          )}
        </div>
      )}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Send back for rework</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What's missing? (optional note to the member)"
              rows={3}
              maxLength={500}
            />
            <Button
              variant="destructive"
              className="w-full"
              disabled={busy}
              onClick={() => void reject()}
            >
              Reject and send back
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}