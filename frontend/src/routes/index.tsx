import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Sitewright — Application" }, { name: "robots", content: "noindex" }] }),
  component: ApplicationEntry,
});

function ApplicationEntry() {
  const navigate = useNavigate();

  useEffect(() => {
    void navigate({ to: "/app", replace: true });
  }, [navigate]);

  return <main className="flex min-h-screen items-center justify-center" role="status">Loading your workspace…</main>;
}
