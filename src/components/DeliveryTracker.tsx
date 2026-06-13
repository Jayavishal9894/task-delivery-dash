import { Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const STAGES = ["Added", "Started", "Working", "Delivered"] as const;

export function DeliveryTracker({
  stage,
  overdue,
}: {
  stage: 0 | 1 | 2 | 3;
  overdue: boolean;
}) {
  return (
    <div className="flex items-center w-full px-1">
      {STAGES.map((label, i) => {
        const done = i < stage || stage === 3;
        const current = i === stage && stage !== 3;
        const isOverdueDot = current && overdue;
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center transition-all duration-300",
                  done && "bg-primary text-primary-foreground",
                  current && !isOverdueDot && "bg-background ring-2 ring-primary text-primary",
                  isOverdueDot && "bg-red-500 text-white animate-pulse",
                  !done && !current && "bg-muted text-muted-foreground",
                )}
              >
                {done ? (
                  <Check className="h-4 w-4" />
                ) : isOverdueDot ? (
                  <AlertCircle className="h-4 w-4" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-current" />
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] mt-1 font-medium",
                  done || current ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div
                className={cn(
                  "h-0.5 flex-1 mx-1 -mt-4 transition-colors duration-300",
                  i < stage ? "bg-primary" : "bg-muted",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}