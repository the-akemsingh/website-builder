import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Composer } from "@/components/Composer";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { ApiError, API_URL, checkBackendHealth, createWebsite } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { absoluteUrl, jsonLd, publicPageHead, SITE_NAME } from "@/lib/seo";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { prompt?: string } => {
    const result: { prompt?: string } = {};
    if (typeof search["prompt"] === "string") result.prompt = search["prompt"];
    return result;
  },
  head: () => ({
    ...publicPageHead({
      title: "Forge — Describe a website, watch it build",
      description:
        "Sign in, write one prompt, and Forge spins up a live website project you can keep refining in chat.",
      path: "/",
    }),
  }),
  component: Index,
});

const EXAMPLES = [
  "Build a modern portfolio website for a photographer",
  "A landing page for a neighbourhood coffee roastery with a menu",
  "A one-page site for an indie climbing gym with class times",
];

function Index() {
  const { prompt: returnedPrompt } = Route.useSearch();
  const { session, ready } = useAuth();
  const navigate = useNavigate();
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [creating, setCreating] = useState(false);
  const [seed, setSeed] = useState<string | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(returnedPrompt ?? null);
  const [creditsDialogOpen, setCreditsDialogOpen] = useState(false);
  const pricingSearch = pendingPrompt ? { prompt: pendingPrompt } : {};

  useEffect(() => {
    let active = true;
    checkBackendHealth().then((ok) => active && setHealthy(ok));
    return () => {
      active = false;
    };
  }, []);

  async function start(prompt: string) {
    if (!session) return;
    setPendingPrompt(null);
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
      if (error instanceof ApiError && error.status === 402) {
        setPendingPrompt(prompt);
        setCreditsDialogOpen(true);
      }
      setCreating(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: SITE_NAME,
            url: absoluteUrl("/"),
            description:
              "A prompt-based website builder with live previews and chat-based refinement.",
          }),
        }}
      />
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
                key={seed ?? pendingPrompt ?? "composer"}
                autoFocus
                initialValue={pendingPrompt ?? ""}
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

        <Dialog open={creditsDialogOpen} onOpenChange={setCreditsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>You’re out of credits</DialogTitle>
              <DialogDescription>
                Your prompt is saved. Choose a plan or add credits, then continue building.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button asChild onClick={() => setCreditsDialogOpen(false)}>
                <Link to="/pricing" search={pricingSearch}>Upgrade</Link>
              </Button>
              <Button asChild variant="outline" onClick={() => setCreditsDialogOpen(false)}>
                <Link to="/pricing" search={pricingSearch}>Buy credits</Link>
              </Button>
            </div>
          </DialogContent>
        </Dialog>

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
