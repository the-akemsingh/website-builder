import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Check, Hammer, Loader2, Play } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { Footer } from "@/components/Footer";
import { Accordion } from "@/components/Accordion";
import { useAuth } from "@/features/auth/auth";
import { useStartBuild } from "@/features/chat/useSubmitPrompt";
import { pendingPrompt } from "@/lib/brand";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sitewright — Describe a website, get a website" },
      { name: "description", content: "Write a prompt and an AI agent builds your website with a live preview." },
      { property: "og:title", content: "Sitewright — Describe a website, get a website" },
      { property: "og:description", content: "Write a prompt and an AI agent builds your website with a live preview." },
    ],
  }),
  component: Landing,
});

const faq = [
  { q: "How do credits work?", a: "Every build or change uses credits based on how much work the agent does. You see the cost after each response and your balance updates live." },
  { q: "Can I get a refund?", a: "Unused top-up credits can be refunded within 14 days of purchase. Subscription months already started are not refunded." },
  { q: "How do I cancel?", a: "Cancel any time from billing. Your plan stays active until the end of the current period, then you move to Free." },
  { q: "Who owns the generated sites?", a: "You do. Everything the agent generates for you is yours to use, edit and publish commercially." },
];

const demos = [
  { tag: "Cafe", title: "Coffee Cartel", desc: "A specialty roaster with a menu, locations and a loyalty signup." },
  { tag: "Portfolio", title: "Studio Mica", desc: "A ceramicist's portfolio with a shop and workshop bookings." },
  { tag: "SaaS", title: "Ledgerline", desc: "Product landing page with pricing and a docs section." },
] as const;

function Composer() {
  const [prompt, setPrompt] = useState("");
  const build = useStartBuild();
  const resumed = useRef(false);

  // Resume a prompt saved before sign-in or checkout.
  useEffect(() => {
    const p = pendingPrompt.get();
    if (p && !p.websiteId) setPrompt(p.prompt);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) build.start(prompt.trim());
  };

  return (
    <form id="prompt" onSubmit={submit} className="panel mx-auto mt-10 max-w-3xl p-3 text-left">
      <label htmlFor="prompt" className="sr-only">Describe your website</label>
      <textarea
        id="prompt-input"
        rows={4}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && submit(e)}
        placeholder="A portfolio for a ceramic artist with a shop and a booking page…"
        className="w-full resize-none bg-transparent p-3 text-lg text-foreground outline-none placeholder:text-body/60"
      />
      <div className="flex items-center justify-between gap-3 px-2 pb-1">
        <p className="text-sm" role="status">
          {build.isError && !build.errorIsCredits ? <span className="text-danger">Couldn't start the build. Try again.</span> : null}
        </p>
        <button type="submit" className="btn btn-primary" disabled={!prompt.trim() || build.isPending}>
          {build.isPending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          Build it
        </button>
      </div>
    </form>
  );
}

/** Signed-in users get the prompt composer; signed-out users get two entry buttons. */
function HeroActions() {
  const { status, signIn } = useAuth();

  if (status === "authed") return <Composer />;

  return (
    <div className="mx-auto mt-10 flex max-w-3xl flex-col justify-center gap-3 sm:flex-row">
      <button className="btn btn-primary" onClick={signIn} disabled={status === "loading"}>
        <Hammer className="size-4" aria-hidden /> Build something
      </button>
      <a href="#demos" className="btn btn-secondary">
        <Play className="size-4" aria-hidden /> See demos
      </a>
    </div>
  );
}

function Demos() {
  return (
    <section id="demos" className="mx-auto max-w-6xl scroll-mt-24 px-6 pb-24" aria-labelledby="demos-heading">
      <h2 id="demos-heading" className="display text-4xl sm:text-5xl">Built with Sitewright</h2>
      <p className="mt-3 max-w-xl">Real sites the agent put together from a single sentence.</p>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {demos.map((d) => (
          <li key={d.title} className="panel flex flex-col gap-3 p-6">
            <span className="chip-accent w-fit">{d.tag}</span>
            <h3 className="text-xl font-semibold">{d.title}</h3>
            <p className="text-body">{d.desc}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Landing() {
  return (
    <div className="min-h-screen">
      <SiteNav announce />
      <main>
        <section className="mx-auto max-w-6xl px-6 pb-24 pt-16 text-center sm:pt-24">
          <h1 className="display text-5xl sm:text-7xl md:text-8xl">
            Describe it.<br />We'll build it.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg">
            Tell the agent what you need. Watch it write, build and preview your website in real time.
          </p>
          <HeroActions />
          <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
            {["Free credits to start", "You own everything it builds"].map((t) => (
              <li key={t} className="flex items-center gap-2"><Check className="size-4" strokeWidth={1.5} aria-hidden />{t}</li>
            ))}
          </ul>
        </section>

        <Demos />

        <section className="mx-auto grid max-w-6xl gap-10 px-6 py-24 md:grid-cols-2" aria-labelledby="faq">
          <h2 id="faq" className="display text-4xl sm:text-5xl">Questions,<br />answered.</h2>
          <Accordion items={faq} />
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="rounded-[28px] bg-accent px-8 py-16 text-center sm:py-24">
            <h2 className="display mx-auto max-w-2xl text-4xl text-ink sm:text-6xl">Your next website is one sentence away.</h2>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <a href="#prompt" className="btn btn-ink">Start building</a>
              <a href="/pricing" className="btn btn-ink-outline">See pricing</a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
