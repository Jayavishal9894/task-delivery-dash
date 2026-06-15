import { useEffect, useMemo } from "react";

type Confetto = {
  left: number;
  delay: number;
  duration: number;
  color: string;
  rotate: number;
  width: number;
  height: number;
};

const COLORS = ["#1D9E75", "#34D399", "#10B981", "#A7F3D0", "#059669", "#6EE7B7"];

export function CelebrationOverlay({
  taskName,
  completedAt,
  onDismiss,
}: {
  taskName: string;
  completedAt: Date;
  onDismiss: () => void;
}) {
  // Auto-dismiss after 2.5s
  useEffect(() => {
    const t = setTimeout(onDismiss, 2500);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const confetti = useMemo<Confetto[]>(
    () =>
      Array.from({ length: 80 }, () => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 1.8 + Math.random() * 1.2,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotate: Math.random() * 360,
        width: 6 + Math.random() * 6,
        height: 10 + Math.random() * 8,
      })),
    [],
  );

  const particles = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        angle: (i / 14) * Math.PI * 2,
        delay: 0.05 + Math.random() * 0.15,
      })),
    [],
  );

  const time = completedAt.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div
      onClick={onDismiss}
      className="fixed inset-0 z-[60] bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center px-6 animate-fade-in cursor-pointer overflow-hidden"
      role="dialog"
      aria-label="Task delivered"
    >
      {/* Confetti */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {confetti.map((c, i) => (
          <span
            key={i}
            style={{
              left: `${c.left}%`,
              top: "-10%",
              width: `${c.width}px`,
              height: `${c.height}px`,
              backgroundColor: c.color,
              transform: `rotate(${c.rotate}deg)`,
              animation: `confetti-fall ${c.duration}s linear ${c.delay}s forwards`,
              borderRadius: "2px",
            }}
            className="absolute"
          />
        ))}
      </div>

      {/* Checkmark with particle burst */}
      <div className="relative flex items-center justify-center">
        {/* Particle burst */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {particles.map((p, i) => (
            <span
              key={i}
              className="absolute h-2 w-2 rounded-full bg-primary/70"
              style={{
                animation: `particle-burst 0.9s ease-out ${p.delay}s forwards`,
                ["--angle" as string]: `${p.angle}rad`,
              }}
            />
          ))}
        </div>
        {/* Pulsing ring */}
        <span
          className="absolute h-44 w-44 rounded-full bg-primary/10"
          style={{ animation: "burst-ring 1.2s ease-out forwards" }}
        />
        {/* SVG check */}
        <svg
          width="160"
          height="160"
          viewBox="0 0 160 160"
          className="relative"
        >
          <circle
            cx="80"
            cy="80"
            r="70"
            fill="none"
            stroke="#1D9E75"
            strokeWidth="6"
            strokeDasharray="440"
            strokeDashoffset="440"
            style={{ animation: "draw-circle 0.7s ease-out 0.05s forwards" }}
          />
          <path
            d="M50 84 L72 106 L114 60"
            fill="none"
            stroke="#1D9E75"
            strokeWidth="10"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="120"
            strokeDashoffset="120"
            style={{ animation: "draw-check 0.5s ease-out 0.55s forwards" }}
          />
        </svg>
      </div>

      <h2
        className="mt-6 text-4xl font-bold text-primary"
        style={{ animation: "pop-in 0.5s cubic-bezier(.2,.9,.3,1.4) 0.9s both" }}
      >
        Delivered!
      </h2>
      <p
        className="mt-3 text-base text-muted-foreground text-center max-w-xs"
        style={{ animation: "fade-up 0.4s ease-out 1.15s both" }}
      >
        {taskName} — delivered
      </p>
      <p
        className="mt-1 text-sm text-muted-foreground"
        style={{ animation: "fade-up 0.4s ease-out 1.3s both" }}
      >
        Delivered at {time}
      </p>
    </div>
  );
}