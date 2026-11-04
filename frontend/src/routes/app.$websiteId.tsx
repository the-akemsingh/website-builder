import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { CreditsChip } from "@/features/billing/billing";
import { Workspace } from "@/features/chat/Workspace";
import { api } from "@/lib/api";

export const Route = createFileRoute("/app/$websiteId")({
  validateSearch: (s: Record<string, unknown>): { prompt?: string | undefined } => ({
    prompt: typeof s["prompt"] === "string" ? s["prompt"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Workspace — Sitewright" },
      { name: "description", content: "Chat with the agent and watch your website build live." },
      { property: "og:title", content: "Workspace — Sitewright" },
      { property: "og:description", content: "Chat with the agent and watch your website build live." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <Page />
    </RequireAuth>
  ),
});

function Page() {
  const { websiteId } = Route.useParams();
  const { prompt } = Route.useSearch();
  const q = useQuery({ queryKey: ["website", websiteId], queryFn: () => api.getWebsite(websiteId), staleTime: Infinity });

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Link to="/app" className="icon-btn" aria-label="Back to websites"><ArrowLeft className="size-4" /></Link>
          <h1 className="truncate text-base font-semibold">{q.data?.website.title ?? "…"}</h1>
        </div>
        <CreditsChip />
      </header>
      {q.isLoading && (
        <div className="grid flex-1 gap-3 p-3 pt-0 md:grid-cols-[minmax(320px,2fr)_3fr]" aria-busy="true">
          <div className="skeleton rounded-[24px]" /><div className="skeleton hidden rounded-[24px] md:block" />
        </div>
      )}
      {q.isError && (
        <main className="flex flex-1 items-center justify-center p-6 text-center" role="alert">
          <div>
            <p className="text-foreground">Couldn't open this website.</p>
            <button className="btn btn-secondary mt-4" onClick={() => q.refetch()}>Retry</button>
          </div>
        </main>
      )}
      {q.data && <Workspace key={websiteId} websiteId={websiteId} detail={q.data} initialPrompt={prompt} />}
    </div>
  );
}
