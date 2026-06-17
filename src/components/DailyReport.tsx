import { useRef } from "react";
import { Share2, Receipt } from "lucide-react";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/button";
import { Task, taskStage } from "@/lib/tasks";

export function DailyReport({
  tasks,
  dateISO,
  streak,
}: {
  tasks: Task[];
  dateISO: string;
  streak: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  const total = tasks.length;
  const completed = tasks.filter((t) => taskStage(t) === 3).length;
  const delayed = tasks.filter((t) => !t.completedAt && !t.deletedAt).length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  const streakAlive = completed > 0;

  const niceDate = new Date(`${dateISO}T12:00:00`).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const handleShare = async () => {
    if (!ref.current) return;
    try {
      const dataUrl = await toPng(ref.current, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `trackit-report-${dateISO}.png`, {
        type: "image/png",
      });
      if (
        navigator.canShare &&
        navigator.canShare({ files: [file] }) &&
        navigator.share
      ) {
        await navigator.share({
          files: [file],
          title: "Daily Delivery Report",
          text: `Trackit · ${niceDate} · ${completed}/${total} delivered`,
        });
        return;
      }
      // Fallback: download
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `trackit-report-${dateISO}.png`;
      a.click();
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-3">
      <div
        ref={ref}
        className="bg-white border rounded-xl p-5 mx-auto max-w-sm font-mono text-slate-900"
        style={{
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          boxShadow:
            "0 1px 0 #fff inset, 0 0 0 1px #e2e8f0, 0 10px 20px -10px rgba(0,0,0,.15)",
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent 0 22px, rgba(15,23,42,.04) 22px 23px)",
        }}
      >
        <div className="text-center border-b border-dashed border-slate-300 pb-3">
          <div className="flex items-center justify-center gap-2">
            <Receipt className="h-4 w-4" />
            <span className="font-bold tracking-widest text-sm">
              DAILY DELIVERY REPORT
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-1">Trackit · {niceDate}</div>
        </div>
        <div className="py-3 text-sm space-y-1.5">
          <Row label="Total tasks" value={String(total)} />
          <Row label="Delivered" value={`${completed} (${pct}%)`} />
          <Row label="Delayed / failed" value={String(delayed)} />
          <Row
            label="Streak"
            value={
              streakAlive ? `🔥 ${streak} day${streak === 1 ? "" : "s"} alive` : "—"
            }
          />
        </div>
        <div className="border-t border-dashed border-slate-300 pt-3 text-center">
          <div className="text-[11px] uppercase tracking-widest text-slate-500">
            Thank you for delivering
          </div>
          <div className="mt-2 flex justify-center gap-[2px]">
            {Array.from({ length: 28 }).map((_, i) => (
              <span
                key={i}
                className="inline-block h-6 w-[2px] bg-slate-800"
                style={{ opacity: i % 3 === 0 ? 1 : 0.6 }}
              />
            ))}
          </div>
        </div>
      </div>
      <Button
        onClick={handleShare}
        className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
      >
        <Share2 className="h-4 w-4 mr-1.5" /> Share to WhatsApp
      </Button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-slate-600">{label}</span>
      <span className="flex-1 mx-2 border-b border-dotted border-slate-300 translate-y-[-3px]" />
      <span className="font-bold">{value}</span>
    </div>
  );
}