import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Package, Check, ArrowRight, Siren, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeliveryTracker } from "@/components/DeliveryTracker";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Trackit — Stop forgetting. Start delivering." },
      {
        name: "description",
        content:
          "The only task app that feels like your to-do list is out for delivery. Join the waitlist.",
      },
      { property: "og:title", content: "Trackit — Stop forgetting. Start delivering." },
      {
        property: "og:description",
        content: "The only task app that feels like your to-do list is out for delivery.",
      },
    ],
  }),
  component: Landing,
});

const emailSchema = z.string().trim().email().max(320);

function AnimatedPreview() {
  const [stage, setStage] = useState<0 | 1 | 2 | 3>(0);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = (s: 0 | 1 | 2 | 3) => {
      if (cancelled) return;
      setStage(s);
      const next = ((s + 1) % 4) as 0 | 1 | 2 | 3;
      // Pause 3s on Completed, otherwise 1.2s per stage
      timer = setTimeout(() => tick(next), s === 3 ? 3000 : 1200);
    };
    tick(0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);
  return (
    <div className="bg-card border rounded-2xl p-5 shadow-lg max-w-sm w-full">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold">Ship the launch email</h3>
          <p className="text-xs text-muted-foreground">Due 4:30 PM</p>
        </div>
        <span className="text-xs bg-primary/10 text-primary font-medium px-2 py-1 rounded-full">
          {stage === 3 ? "Delivered" : stage > 0 ? "In progress" : "Pending"}
        </span>
      </div>
      <div className="py-3">
        <DeliveryTracker stage={stage} overdue={false} justAdded={stage === 0} />
      </div>
    </div>
  );
}

const SPOTS_CLAIMED = 347;
const SPOTS_TOTAL = 500;

function WaitlistForm({ idSuffix = "" }: { idSuffix?: string }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      toast.error("Enter a valid email");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("waitlist").insert({ email: parsed.data });
    setLoading(false);
    if (error && !error.message.includes("duplicate")) {
      toast.error("Couldn't join — try again");
      return;
    }
    setDone(true);
    toast.success("You're in!");
  };

  if (done) {
    return (
      <div className="max-w-md rounded-xl border bg-card p-5 flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
          <Check className="h-5 w-5" />
        </div>
        <div>
          <div className="font-semibold">Your spot is locked in</div>
          <div className="text-sm text-muted-foreground">
            We'll email you the moment it's ready.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md">
      <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
        <Input
          type="email"
          id={`email${idSuffix}`}
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12"
          maxLength={320}
          required
        />
        <Button
          type="submit"
          disabled={loading}
          className="h-12 bg-primary hover:bg-primary/90 px-6 whitespace-nowrap"
        >
          {loading ? "Claiming…" : "Claim my lifetime access"}
        </Button>
      </form>
      <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
        <p className="text-xs text-muted-foreground">
          Free forever for early members · No credit card needed
        </p>
        <p className="text-xs font-semibold text-red-600">
          ⚡ {SPOTS_CLAIMED} / {SPOTS_TOTAL} spots claimed
        </p>
      </div>
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <div className="w-full bg-amber-400 text-amber-950 text-center text-sm font-bold py-2 px-4">
        🚀 Launching soon — first 500 people get lifetime access free
      </div>

      <header className="px-5 py-4 flex items-center justify-between max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <Package className="h-4 w-4" />
          </div>
          <span className="font-bold text-lg">Trackit</span>
        </div>
        <Link
          to="/app"
          className="text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          Try the app <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      <main className="px-5 max-w-5xl mx-auto pt-8 pb-20">
        {/* Hero */}
        <section className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground leading-[1.1]">
              Stop forgetting.<br />
              Start <span className="text-primary">delivering</span>.
            </h1>
            <p className="mt-5 text-lg text-muted-foreground leading-relaxed">
              The only task app that feels like your to-do list is out for delivery.
            </p>
            <div className="mt-8">
              <WaitlistForm />
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Or skip the line —{" "}
              <Link to="/app" className="text-primary font-medium underline">
                try it now
              </Link>
              .
            </p>
          </div>
          <div className="flex justify-center">
            <AnimatedPreview />
          </div>
        </section>

        {/* Features */}
        <section className="mt-24">
          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                icon: "📦",
                title: "Delivery-style tracker",
                body: "Watch your tasks move like a Swiggy order. Created → Scheduled → In Progress → Delivered.",
              },
              {
                icon: "🚨",
                title: "Full-screen urgent alerts",
                body: "High priority tasks take over your screen until done. No more ignored notifications.",
              },
              {
                icon: "🔁",
                title: "Routine-based reminders",
                body: "Set tasks to trigger after breakfast or after lunch — not just at a random time.",
              },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="text-3xl mb-3" aria-hidden>{f.icon}</div>
                <h3 className="font-semibold text-lg">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* What you get */}
        <section className="mt-24">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center">
            Join early. Get rewarded.
          </h2>
          <div className="mt-10 grid md:grid-cols-3 gap-5">
            {[
              { icon: "🎯", title: "Lifetime access", body: "Pay nothing, ever. Yours forever." },
              { icon: "⚡", title: "Shape the product", body: "Your feedback directly builds what comes next." },
              { icon: "🥇", title: "First access", body: "Use it before anyone else does." },
            ].map((p) => (
              <div key={p.title} className="rounded-2xl border bg-card p-6 text-center">
                <div className="text-3xl mb-3" aria-hidden>{p.icon}</div>
                <h3 className="font-semibold text-lg">{p.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Second CTA */}
        <section className="mt-24">
          <div className="rounded-3xl border bg-card p-8 md:p-12 text-center">
            <p className="text-base md:text-lg font-medium text-foreground">
              Still scrolling? That's fine. But the 500 spots won't wait.
            </p>
            <div className="mt-6 flex justify-center">
              <WaitlistForm idSuffix="-bottom" />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
