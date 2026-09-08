import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { BuildFeed } from "@/components/BuildFeed";
import { Composer } from "@/components/Composer";
import { Button } from "@/components/ui/button";
import { useBuildSession } from "@/hooks/useBuildSession";
import { ApiError, getWebsite } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { FeedItem, WebsiteDetails } from "@/lib/types";

export const Route = createFileRoute("/workspace/$websiteId")({
  validateSearch: (search: Record<string, unknown>): { prompt?: string | undefined } => ({
    prompt: typeof search["prompt"] === "string" ? (search["prompt"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Workspace — Forge" },
      {
        name: "description",
        content: "Chat with the builder on the left, watch your live website preview on the right.",
      },
      { property: "og:title", content: "Workspace — Forge" },
      {
        property: "og:description",
        content: "Chat with the builder on the left, watch your live website preview on the right.",
      },
    ],
  }),
  component: Workspace,
});

const STATE_LABEL: Record<string, string> = {
  idle: "Ready",
  connecting: "Connecting",
  ai_processing: "Thinking",
  running_tool: "Running tool",
  completed: "Done",
  connection_lost: "Disconnected",
  error: "Error",
};

function historyToFeedItem(message: WebsiteDetails["project"]["Messages"][number]): FeedItem {
  if (message.role === "user") {
    return {
      kind: "user",
      id: message.id,
      text: message.text || "(Empty user message)",
    };
  }

  if (message.role === "model" && message.text) {
    return { kind: "model", id: message.id, text: message.text };
  }

  if (message.functionCallName) {
    const failed = message.functionCallResponse?.toLowerCase().includes('"error"') ?? false;
    return {
      kind: "tool",
      id: message.id,
      tool: message.functionCallName,
      status: message.role === "tool" ? (failed ? "failed" : "done") : "done",
      live: false,
    };
  }

  if (message.text) {
    return { kind: "log", id: message.id, text: message.text };
  }

  return {
    kind: "log",
    id: message.id,
    text: `${message.role || "system"} activity`,
  };
}

function Workspace() {
  const { websiteId } = Route.useParams();
  const { prompt } = Route.useSearch();
  const { session, ready, signOut } = useAuth();
  const navigate = useNavigate();

  const [details, setDetails] = useState<WebsiteDetails | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewNonce, setPreviewNonce] = useState(0);
  const [initialPrompt] = useState<string | null>(prompt ?? null);
  const [previewReady, setPreviewReady] = useState(false);

  const onFinal = useCallback(() => {
    setPreviewReady(true);
    setPreviewNonce(Date.now());
  }, []);

  const { feed, seedFeed, state, busy, connected, closedInvalid, sendPrompt } = useBuildSession({
    websiteId,
    initialPrompt,
    onFinal,
  });

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      navigate({ to: "/" });
      return;
    }
    let active = true;
    getWebsite(websiteId, session.token)
      .then((data) => {
        if (!active) return;
        setDetails(data);
        const history: FeedItem[] = data.project.Messages.map(historyToFeedItem);
        setPreviewReady(
          !initialPrompt || history.some((item) => item.kind === "model" && item.text.length > 0),
        );
        if (history.length) seedFeed(history);
      })
      .catch((e: unknown) => {
        if (!active) return;
        if (e instanceof ApiError && e.status === 401) {
          signOut();
          navigate({ to: "/" });
          return;
        }
        setLoadError(e instanceof Error ? e.message : "Couldn't load this project.");
      });
    return () => {
      active = false;
    };
  }, [initialPrompt, ready, session, websiteId, navigate, signOut, seedFeed]);

  const previewUrl = useMemo(() => {
    if (!previewReady || !details?.url) return null;
    return previewNonce ? `${details.url}?refresh=${previewNonce}` : details.url;
  }, [details?.url, previewNonce, previewReady]);

  const showPreview = previewReady && !busy;

  if (closedInvalid || (loadError && !details)) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <AppHeader />
        <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 px-5 text-center">
          <TriangleAlert className="size-6 text-destructive" />
          <p className="text-sm text-muted-foreground">
            {closedInvalid ? "This project is invalid or no longer exists." : loadError}
          </p>
          <Button asChild variant="pill" size="pill">
            <Link to="/projects">Back to projects</Link>
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <AppHeader />
      <div
        className={
          showPreview
            ? "grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(360px,42%)_1fr]"
            : "flex flex-1 justify-center overflow-hidden"
        }
      >
        {/* Chat side — dark */}
        <section
          className={
            showPreview
              ? "flex min-h-0 flex-col border-r border-panel-border bg-panel"
                : "flex min-h-0 w-full flex-col bg-panel"
          }
        >
          <div className="flex items-center gap-3 border-b border-panel-border px-5 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-panel-foreground">
                {details?.project.title || "Untitled project"}
              </p>
              <p className="mono truncate text-[11px] text-panel-muted">{websiteId}</p>
            </div>
            <span className="mono ml-auto flex items-center gap-1.5 rounded-full border border-panel-border px-3 py-1 text-[11px] text-panel-muted">
              <span
                className={
                  connected ? "size-1.5 rounded-full bg-success" : "size-1.5 rounded-full bg-destructive"
                }
              />
              {STATE_LABEL[state] ?? state}
            </span>
          </div>

          <BuildFeed items={feed} busy={busy} />

          <div className="flex flex-col items-center border-t border-panel-border p-4">
            {state === "connection_lost" && (
              <div className="mb-3 flex w-full max-w-2xl items-center justify-between gap-3 rounded-2xl border border-panel-border px-4 py-2">
                <p className="text-xs text-panel-muted">Connection lost.</p>
                <Button
                  variant="pillOutline"
                  size="pillSm"
                  onClick={() => window.location.reload()}
                >
                  Reconnect
                </Button>
              </div>
            )}
            <div className="w-full max-w-2xl">
              <Composer
                tone="dark"
                disabled={busy || !connected}
                onSubmit={sendPrompt}
                placeholder="Add a testimonials section with three customer quotes…"
                hint={connected ? undefined : "Waiting for the build server…"}
              />
            </div>
          </div>
        </section>

        {showPreview && (
          <section className="flex min-h-0 flex-col bg-background">
            <div className="flex items-center gap-3 border-b border-border px-5 py-3">
              <p className="mono flex-1 truncate rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
                {details?.url}
              </p>
              <Button
                variant="quiet"
                size="pillIcon"
                aria-label="Refresh preview"
                disabled={!details?.url}
                onClick={() => setPreviewNonce(Date.now())}
              >
                <RefreshCw />
              </Button>
            </div>
            <div className="min-h-0 flex-1 bg-card">
              {previewUrl && (
                <iframe
                  key={previewUrl}
                  src={previewUrl}
                  title="Website preview"
                  className="h-full w-full border-0"
                />
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
