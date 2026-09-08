import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Composer } from "@/components/Composer";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { ApiError, API_URL, checkBackendHealth, createWebsite } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Forge — Describe a website, watch it build" },
      {
        name: "description",
        content:
          "Sign in, write one prompt, and Forge spins up a live website project you can keep refining in chat.",
      },
      { property: "og:title", content: "Forge — Describe a website, watch it build" },
      {
        property: "og:description",
        content:
          "Sign in, write one prompt, and Forge spins up a live website project you can keep refining in chat.",
      },
    ],
  }),
  component: Index,
});

const EXAMPLES = [
  "Build a modern portfolio website for a photographer",
  "A landing page for a neighbourhood coffee roastery with a menu",
  "A one-page site for an indie climbing gym with class times",
];

function Index() {
  const { session, ready } = useAuth();
  const navigate = useNavigate();
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [creating, setCreating] = useState(false);
  const [seed, setSeed] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    checkBackendHealth().then((ok) => active && setHealthy(ok));
    return () => {
      active = false;
    };
  }, []);

  async function start(prompt: string) {
    if (!session) return;
    setCreating(true);
    try {
      const project = await createWebsite(prompt, session.token);
      navigate({
        to: "/workspace/$websiteId",
        params: { websiteId: project.websiteId },
        search: { prompt },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong.";
      toast.error(message);
      if (error instanceof ApiError && error.status === 401) {
        window.localStorage.removeItem("forge.session");
        window.location.reload();
      }
      setCreating(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-16">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Describe it. <span className="text-accent">Forge builds it.</span>
        </h1>
        <p className="mt-3 max-w-xl text-base text-muted-foreground">
          One prompt spins up a real project with a live preview. Keep chatting to change it.
        </p>

        <div className="mt-8">
          {!ready ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : !session ? (
            <div className="rounded-3xl border border-border bg-card p-8">
              <p className="mb-5 text-sm text-muted-foreground">
                Sign in with Google to start a project.
              </p>
              <GoogleSignInButton />
            </div>
          ) : creating ? (
            <div className="flex items-center gap-3 rounded-3xl border border-border bg-card p-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-accent" />
              Creating your project and starting the preview server…
            </div>
          ) : (
            <>
              <Composer
                key={seed ?? "composer"}
                autoFocus
                onSubmit={start}
                placeholder="Build a modern portfolio website for a photographer…"
              />
              <div className="mt-4 flex flex-wrap gap-2">
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    onClick={() => {
                      setSeed(example);
                      start(example);
                    }}
                    className="rounded-full border border-border bg-card px-4 py-1.5 text-xs text-muted-foreground transition-colors hover:border-accent hover:text-foreground"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <p className="mono mt-10 text-xs text-muted-foreground">
          <span
            className={
              healthy === null
                ? "text-muted-foreground"
                : healthy
                  ? "text-success"
                  : "text-destructive"
            }
          >
            ●
          </span>{" "}
          {healthy === null ? "checking" : healthy ? "backend online" : "backend unreachable"} ·{" "}
          {API_URL}
        </p>
      </main>
    </div>
  );
}
