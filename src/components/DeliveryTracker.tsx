import { Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const STAGES = ["Created", "Scheduled", "In Progress", "Completed"] as const;

export function DeliveryTracker({
  stage,
  overdue,
}: {
  stage: 0 | 1 | 2 | 3;
  overdue: boolean;
}) {
  return (
    <div className="flex items-start w-full px-1">
      {STAGES.map((label, i) => {
        const done = i < stage || stage === 3;
        const current = i === stage && stage !== 3;
        const isOverdueDot = current && overdue;
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center transition-all duration-300 border-2",
                  done && "bg-primary border-primary text-primary-foreground",
                  current && !isOverdueDot && "bg-background border-primary text-primary",
                  isOverdueDot && "bg-red-500 border-red-500 text-white animate-pulse",
                  !done && !current && "bg-background border-muted-foreground/30 text-muted-foreground",
                )}
              >
                {done ? (
                  <Check className="h-5 w-5" strokeWidth={3} />
                ) : isOverdueDot ? (
                  <AlertCircle className="h-5 w-5" />
                ) : null}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium text-center leading-tight whitespace-nowrap",
                  done && "text-primary",
                  current && !isOverdueDot && "text-primary",
                  isOverdueDot && "text-red-500",
                  !done && !current && "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div
                className={cn(
                  "flex-1 mx-2 mt-5 border-t-2 border-dashed transition-colors duration-300",
                  i < stage ? "border-primary" : "border-muted-foreground/30",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}