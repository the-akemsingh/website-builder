import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { SiteNav } from "@/components/SiteNav";
import { Footer } from "@/components/Footer";
import { api } from "@/lib/api";
import { useAuth } from "@/features/auth/auth";
import { useBillingMe, useCheckout } from "@/features/billing/billing";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Sitewright" },
      { name: "description", content: "Simple credit-based plans. Start free, upgrade when you build more." },
      { property: "og:title", content: "Pricing — Sitewright" },
      { property: "og:description", content: "Simple credit-based plans. Start free, upgrade when you build more." },
    ],
  }),
  component: Pricing,
});

const TOPUPS = [100, 200, 500];

function Pricing() {
  const plans = useQuery({ queryKey: ["plans"], queryFn: api.plans });
  const me = useBillingMe();
  const { status, signIn } = useAuth();
  const checkout = useCheckout();
  const [topup, setTopup] = useState<number>(200);
  const go = (body: Parameters<typeof checkout.mutate>[0]) => (status === "authed" ? checkout.mutate(body) : signIn());

  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-12 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em]">Pricing</p>
        <h1 className="display mt-4 text-5xl sm:text-7xl">Pay for what you build.</h1>
        <p className="mx-auto mt-5 max-w-lg text-lg">Every plan uses credits. Start free and upgrade when you need more.</p>
        {checkout.isError && <p className="mt-6 text-danger" role="alert">Checkout couldn't start. Please try again.</p>}

        {plans.isLoading && (
          <div className="mt-14 grid gap-4 md:grid-cols-3" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-[480px] rounded-[24px]" />)}</div>
        )}
        {plans.isError && (
          <div className="panel mt-14 p-8" role="alert">
            <p className="text-foreground">Couldn't load plans.</p>
            <button className="btn btn-secondary mt-4" onClick={() => plans.refetch()}>Retry</button>
          </div>
        )}
        {plans.data && (
          <div className="mt-14 grid items-stretch gap-4 text-left md:grid-cols-3">
            {plans.data.map((p) => {
              const current = me.data?.planKey === p.key;
              const pending = checkout.isPending && checkout.variables && "planKey" in checkout.variables && checkout.variables.planKey === p.key;
              return (
                <article key={p.key} className={`panel relative flex flex-col p-7 ${p.recommended ? "border-accent" : ""}`}>
                  {p.recommended && <span className="chip-accent absolute right-6 top-6">Most popular</span>}
                  <p className="text-sm">{p.label}</p>
                  <h2 className="mt-1 text-xl font-semibold">{p.name}</h2>
                  <p className="mt-6"><span className="display text-6xl text-foreground">${p.priceMonthly}</span> <span className="text-sm">/ month</span></p>
                  <p className="mt-3">{p.description}</p>
                  <hr className="my-6" />
                  <ul className="flex-1 space-y-3">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-3"><Check className="mt-1 size-4 shrink-0 text-foreground" strokeWidth={1.25} aria-hidden />{f}</li>
                    ))}
                  </ul>
                  <button
                    className={`btn mt-8 w-full ${p.recommended ? "btn-primary" : "btn-secondary"}`}
                    disabled={current || checkout.isPending || p.priceMonthly === 0}
                    onClick={() => go({ planKey: p.key })}
                  >
                    {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                    {current ? "Current plan" : p.priceMonthly === 0 ? "Included" : `Get ${p.name}`}
                  </button>
                </article>
              );
            })}
          </div>
        )}

        <div className="panel mt-6 flex flex-col items-center justify-between gap-4 px-7 py-5 text-left sm:flex-row">
          <div>
            <h2 className="font-semibold">Need more credits?</h2>
            <p className="text-sm">One-time top-up, never expires.</p>
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="topup" className="sr-only">Top-up amount</label>
            <select id="topup" value={topup} onChange={(e) => setTopup(Number(e.target.value))} className="rounded-full border bg-background px-4 py-2.5 text-foreground">
              {TOPUPS.map((t) => <option key={t} value={t}>{t} credits</option>)}
            </select>
            <button className="btn btn-primary" disabled={checkout.isPending} onClick={() => go({ topupCredits: topup })}>Buy</button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
