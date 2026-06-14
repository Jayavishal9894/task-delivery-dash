import { Package, Clock, Zap, Trophy, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const STAGES = [
  { label: "Created", Icon: Package, anim: "anim-dot-bounce" },
  { label: "Scheduled", Icon: Clock, anim: "anim-spin-slow" },
  { label: "In Progress", Icon: Zap, anim: "anim-bolt-pulse" },
  { label: "Completed", Icon: Trophy, anim: "anim-trophy-pop" },
] as const;

export function DeliveryTracker({
  stage,
  overdue,
  justAdded,
}: {
  stage: 0 | 1 | 2 | 3;
  overdue: boolean;
  justAdded?: boolean;
}) {
  return (
    <div className="flex items-start w-full px-1">
      {STAGES.map(({ label, Icon, anim }, i) => {
        const done = i < stage || stage === 3;
        const current = i === stage && stage !== 3;
        const isOverdue = overdue && !done && current;
        const isDelayedAll = overdue && stage < 3;
        // animate icons:
        // - Created: bounce only when just added & still at stage 0
        // - Scheduled / In Progress: animate when current
        // - Completed: pop when stage === 3
        let iconAnim = "";
        if (i === 0 && justAdded && stage === 0) iconAnim = anim;
        else if (i === 1 && current) iconAnim = anim;
        else if (i === 2 && current) iconAnim = anim;
        else if (i === 3 && stage === 3) iconAnim = anim;

        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "rounded-full flex items-center justify-center transition-all duration-300 border-2",
                  current ? "h-12 w-12" : "h-10 w-10",
                  done && "bg-primary border-primary text-primary-foreground",
                  current && !isOverdue && "bg-background border-primary text-primary anim-glow-ring",
                  isOverdue && "bg-red-500 border-red-500 text-white animate-pulse",
                  isDelayedAll && !current && !done && "border-red-400 text-red-500",
                  !done && !current && !isDelayedAll && "bg-background border-muted-foreground/30 text-muted-foreground",
                )}
              >
                {isDelayedAll && !done ? (
                  <AlertTriangle className={cn("h-5 w-5", iconAnim)} />
                ) : (
                  <Icon className={cn("h-5 w-5", iconAnim)} strokeWidth={2.2} />
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium text-center leading-tight whitespace-nowrap",
                  done && "text-primary",
                  current && !isOverdue && "text-primary",
                  (isOverdue || isDelayedAll) && "text-red-500",
                  !done && !current && !isDelayedAll && "text-muted-foreground",
                )}
              >
                {isDelayedAll && !done && i === stage ? "Delayed" : label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div className="flex-1 mx-2 mt-5 h-0 relative">
                <div className="absolute inset-0 border-t-2 border-dashed border-muted-foreground/30" />
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 border-t-2 border-dashed transition-all duration-700",
                    isDelayedAll ? "border-red-400" : "border-primary",
                  )}
                  style={{ width: i < stage ? "100%" : "0%" }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}