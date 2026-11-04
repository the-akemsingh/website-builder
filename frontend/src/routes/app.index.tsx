import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { api } from "@/lib/api";

export const Route = createFileRoute("/app/")({
  validateSearch: (s: Record<string, unknown>): { paid?: boolean | undefined } => ({ paid: s["paid"] === true || s["paid"] === "1" || s["paid"] === 1 ? true : undefined }),
  head: () => ({
    meta: [
      { title: "My websites — Sitewright" },
      { name: "description", content: "All the websites you've built with Sitewright." },
      { property: "og:title", content: "My websites — Sitewright" },
      { property: "og:description", content: "All the websites you've built with Sitewright." },
    ],
  }),
  component: () => (
    <>
      <SiteNav />
      <RequireAuth>
        <Dashboard />
      </RequireAuth>
    </>
  ),
});

function Dashboard() {
  const { paid } = Route.useSearch();
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: ["websites"], queryFn: api.listWebsites });
  const deleteWebsite = useMutation({
    mutationFn: (websiteId: string) => api.deleteWebsite(websiteId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["websites"] });
    },
  });

  function removeWebsite(websiteId: string, title: string) {
    if (deleteWebsite.isPending) return;
    if (!window.confirm(`Delete "${title || "this website"}"? This cannot be undone.`)) return;
    deleteWebsite.mutate(websiteId);
  }

  return (
    <main className="mx-auto max-w-6xl px-6 pb-24 pt-8">
      {paid && (
        <p role="status" className="panel mb-8 flex items-center gap-3 px-5 py-4 text-foreground">
          <CheckCircle2 className="size-5 text-accent" aria-hidden /> Payment confirmed. Your credits are ready.
        </p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="display text-4xl sm:text-5xl">Your websites</h1>
        <Link to="/" className="btn btn-primary"><Plus className="size-4" />New website</Link>
      </div>

      {q.isLoading && (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton h-40 rounded-[24px]" />)}
        </div>
      )}
      {q.isError && (
        <div className="panel mt-10 p-8" role="alert">
          <p className="text-foreground">Couldn't load your websites.</p>
          <button className="btn btn-secondary mt-4" onClick={() => q.refetch()}>Retry</button>
        </div>
      )}
      {q.data?.length === 0 && (
        <div className="panel mt-10 px-8 py-16 text-center">
          <h2 className="display text-3xl">No websites yet</h2>
          <p className="mt-2">Describe one and the agent will build it.</p>
        </div>
      )}
      {!!q.data?.length && (
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {q.data.map((w) => (
            <li key={w.id} className="panel flex h-full flex-col">
              <Link
                to="/app/$websiteId"
                params={{ websiteId: w.id }}
                className="group flex min-h-40 flex-1 flex-col justify-between gap-8 p-6 transition-colors duration-150 hover:bg-surface-2"
              >
                <div>
                  <p className="text-sm">{w.template}</p>
                  <h2 className="mt-1 text-xl font-semibold">{w.title}</h2>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <time dateTime={w.createdAt}>{new Date(w.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</time>
                  <span className="flex items-center gap-1 font-medium text-foreground">
                    Open <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </div>
              </Link>
              <div className="flex justify-end border-t px-6 py-3">
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-sm text-danger transition-colors hover:text-danger/80 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => removeWebsite(w.id, w.title)}
                  disabled={deleteWebsite.isPending}
                  aria-label={`Delete ${w.title || "website"}`}
                >
                  {deleteWebsite.isPending && deleteWebsite.variables === w.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {deleteWebsite.isError && (
        <p className="mt-4 text-sm text-danger" role="alert">
          Couldn't delete the website. Please try again.
        </p>
      )}
    </main>
  );
}
