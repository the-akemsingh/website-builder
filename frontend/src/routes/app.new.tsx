import { createFileRoute } from "@tanstack/react-router";
import { ArrowUp, Loader2 } from "lucide-react";
import { useState } from "react";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { useStartBuild } from "@/features/chat/useSubmitPrompt";

export const Route = createFileRoute("/app/new")({
  head: () => ({ meta: [{ title: "New website — Sitewright" }] }),
  component: () => <RequireAuth><NewWebsite /></RequireAuth>,
});

function NewWebsite() {
  const [prompt, setPrompt] = useState("");
  const build = useStartBuild();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (prompt.trim()) build.start(prompt.trim());
  }

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-16 text-center">
      <h1 className="display text-5xl">Describe your website.</h1>
      <p className="mt-4">Tell the agent what to build and watch it come together.</p>
      <form onSubmit={submit} className="panel mt-10 p-3 text-left">
        <label htmlFor="prompt-input" className="sr-only">Describe your website</label>
        <textarea id="prompt-input" rows={5} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="A portfolio for a ceramic artist with a shop and a booking page…" className="w-full resize-none bg-transparent p-3 text-lg text-foreground outline-none placeholder:text-body/60" />
        <div className="flex justify-end px-2 pb-1">
          <button type="submit" className="btn btn-primary" disabled={!prompt.trim() || build.isPending}>
            {build.isPending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />} Build it
          </button>
        </div>
      </form>
    </main>
  );
}
