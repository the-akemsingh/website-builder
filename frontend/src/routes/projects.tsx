import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { ApiError, deleteWebsite, listWebsites } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { WebsiteSummary } from "@/lib/types";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Your projects — Forge" },
      { name: "description", content: "Every website you've built with Forge, with live previews." },
      { property: "og:title", content: "Your projects — Forge" },
      {
        property: "og:description",
        content: "Every website you've built with Forge, with live previews.",
      },
    ],
  }),
  component: Projects,
});

function Projects() {
  const { session, ready, signOut } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<WebsiteSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      navigate({ to: "/" });
      return;
    }
    let active = true;
    listWebsites(session.token)
      .then((data) => active && setItems(data))
      .catch((e: unknown) => {
        if (!active) return;
        if (e instanceof ApiError && e.status === 401) {
          signOut();
          navigate({ to: "/" });
          return;
        }
        setError(e instanceof Error ? e.message : "Couldn't load your projects.");
        setItems([]);
      });
    return () => {
      active = false;
    };
  }, [ready, session, navigate, signOut]);

  async function remove(id: string) {
    if (!session) return;
    setRemoving(id);
    try {
      await deleteWebsite(id, session.token);
      setItems((prev) => (prev ?? []).filter((item) => item.id !== id));
      toast.success("Project deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Your projects</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Open one to keep building, or start something new.
            </p>
          </div>
          <Button asChild variant="pill" size="pill">
            <Link to="/">New project</Link>
          </Button>
        </div>

        {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

        {items === null ? (
          <p className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading projects…
          </p>
        ) : items.length === 0 ? (
          <p className="mt-10 rounded-3xl border border-border bg-card p-8 text-sm text-muted-foreground">
            Nothing here yet. Write your first prompt on the home page.
          </p>
        ) : (
          <ul className="mt-8 space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 transition-colors hover:border-accent"
              >
                <Link
                  to="/workspace/$websiteId"
                  params={{ websiteId: item.id }}
                  search={{ prompt: undefined }}
                  className="min-w-0 flex-1"
                >
                  <p className="truncate font-medium">{item.title || "Untitled project"}</p>
                  <p className="mono mt-1 truncate text-xs text-muted-foreground">
                    {item.templateName} · {item.id} ·{" "}
                    {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                </Link>
                <Button
                  variant="quiet"
                  size="pillIcon"
                  aria-label={`Delete ${item.title}`}
                  disabled={removing === item.id}
                  onClick={() => remove(item.id)}
                >
                  {removing === item.id ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Trash2 className="text-muted-foreground" />
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
