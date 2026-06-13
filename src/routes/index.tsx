import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Package, Check, ArrowRight } from "lucide-react";
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
  // cycle stages
  if (typeof window !== "undefined") {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useStageCycle(setStage);
  }
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
        <DeliveryTracker stage={stage} overdue={false} />
      </div>
    </div>
  );
}

function useStageCycle(set: (s: 0 | 1 | 2 | 3) => void) {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const ref = useStageInterval(set);
  return ref;
}

import { useEffect, useRef } from "react";
function useStageInterval(set: (s: 0 | 1 | 2 | 3) => void) {
  const ref = useRef(0);
  useEffect(() => {
    const i = setInterval(() => {
      ref.current = (ref.current + 1) % 4;
      set(ref.current as 0 | 1 | 2 | 3);
    }, 1400);
    return () => clearInterval(i);
  }, [set]);
  return ref;
}

function Landing() {
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
    toast.success("You're on the list!");
  };

  return (
    <div className="min-h-screen bg-background">
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
        <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-medium px-3 py-1.5 rounded-full mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Now in private beta
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground leading-[1.1]">
              Stop forgetting.<br />
              Start <span className="text-primary">delivering</span>.
            </h1>
            <p className="mt-5 text-lg text-muted-foreground leading-relaxed">
              The only task app that feels like your to-do list is out for delivery.
            </p>

            {!done ? (
              <form onSubmit={submit} className="mt-8 flex flex-col sm:flex-row gap-2 max-w-md">
                <Input
                  type="email"
                  placeholder="you@work.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12"
                  maxLength={320}
                  required
                />
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-12 bg-primary hover:bg-primary/90 px-6"
                >
                  {loading ? "Joining…" : "Join the waitlist"}
                </Button>
              </form>
            ) : (
              <div className="mt-8 max-w-md rounded-xl border bg-card p-5 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  <Check className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold">You're on the list</div>
                  <div className="text-sm text-muted-foreground">
                    We'll email when your spot's ready.
                  </div>
                </div>
              </div>
            )}

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
        </div>
      </main>
    </div>
  );
}
