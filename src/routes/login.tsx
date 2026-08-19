import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AuthPage } from "@/components/AuthPage";

const loginSearchSchema = z.object({
  join: z.string().optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: loginSearchSchema.parse,
  head: () => ({
    meta: [
      { title: "Sign in to Trackit — Team task delivery" },
      {
        name: "description",
        content:
          "Sign in or create your Trackit account to assign tasks to your team and track every delivery live.",
      },
      { property: "og:title", content: "Sign in to Trackit" },
      {
        property: "og:description",
        content: "Assign tasks to your team and track every delivery live.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => {
    const { join } = Route.useSearch();
    return <AuthPage join={join} />;
  },
});
