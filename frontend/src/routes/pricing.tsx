import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { ApiError, createCheckout, getBillingPlans } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { BillingPlan } from "@/lib/types";
import { absoluteUrl, jsonLd, publicPageHead, SITE_NAME } from "@/lib/seo";

export const Route = createFileRoute("/pricing")({
  validateSearch: (search: Record<string, unknown>): { websiteId?: string; prompt?: string } => {
    const result: { websiteId?: string; prompt?: string } = {};
    if (typeof search["websiteId"] === "string") result.websiteId = search["websiteId"];
    if (typeof search["prompt"] === "string") result.prompt = search["prompt"];
    return result;
  },
  head: () => ({
    ...publicPageHead({
      title: "Plans — Forge",
      description: "Choose a Forge plan and keep building websites with shared credits.",
      path: "/pricing",
    }),
  }),
  component: Pricing,
});

function formatPrice(plan: BillingPlan) {
  if (plan.priceMinor === 0) return "Free";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: plan.currency,
    maximumFractionDigits: 0,
  }).format(plan.priceMinor / 100);
}

function Pricing() {
  const { websiteId, prompt } = Route.useSearch();
  const { session, ready } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<BillingPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [topupCredits, setTopupCredits] = useState("1000");
  const pricingSearch = prompt || websiteId
    ? { ...(websiteId ? { websiteId } : {}), ...(prompt ? { prompt } : {}) }
    : undefined;

  useEffect(() => {
    let active = true;
    getBillingPlans()
      .then((data) => active && setPlans(data))
      .catch((e: unknown) => active && setError(e instanceof Error ? e.message : "Couldn't load plans."));
    return () => {
      active = false;
    };
  }, []);

  async function buy(input: { planKey?: string; topupCredits?: number }, key: string) {
    if (!session) {
      navigate({ to: "/" });
      return;
    }
    setBusy(key);
    try {
      const returnUrl = new URL("/billing/return", window.location.origin);
      if (websiteId) returnUrl.searchParams.set("websiteId", websiteId);
      if (prompt) returnUrl.searchParams.set("prompt", prompt);
      const checkout = await createCheckout(session.token, {
        ...input,
        returnUrl: returnUrl.toString(),
      });
      window.location.assign(checkout.checkoutUrl);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        navigate({ to: "/" });
        return;
      }
      toast.error(e instanceof Error ? e.message : "Couldn't start checkout.");
      setBusy(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "Plans — Forge",
            description: "Choose a Forge plan and keep building websites with shared credits.",
            url: absoluteUrl("/pricing"),
            isPartOf: { "@type": "WebSite", name: SITE_NAME, url: absoluteUrl("/") },
          }),
        }}
      />
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-14 sm:py-20">
        <div className="max-w-xl">
          <p className="mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Forge plans</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Keep building.</h1>
          <p className="mt-4 text-base text-muted-foreground">
            Credits are shared across every build and renew with your subscription.
          </p>
        </div>

        {error && <p className="mt-10 text-sm text-destructive">{error}</p>}
        {plans === null && !error ? (
          <p className="mt-12 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading plans…
          </p>
        ) : plans && plans.length > 0 ? (
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {plans.slice(0, 3).map((plan, index) => {
              const recommended = plan.key.toLowerCase() === "pro" || (index === 1 && plans.length >= 3);
              return (
                <article
                  key={plan.id}
                  className={`flex min-h-80 flex-col rounded-2xl border bg-card p-6 ${
                    recommended ? "border-foreground" : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-bold">{plan.name}</h2>
                      {recommended && (
                        <p className="mt-1 text-xs font-medium text-muted-foreground">Recommended</p>
                      )}
                    </div>
                    <Check className="size-5 text-accent" />
                  </div>
                  <p className="mt-8 text-3xl font-bold">{formatPrice(plan)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">per {plan.interval}</p>
                  <p className="mt-6 text-sm font-medium">{plan.monthlyCredits.toLocaleString()} credits / month</p>
                  <Button
                    className="mt-auto w-full"
                    variant={recommended ? "default" : "outline"}
                    onClick={() => buy({ planKey: plan.key }, plan.key)}
                    disabled={busy !== null}
                  >
                    {busy === plan.key && <Loader2 className="animate-spin" />}
                    Choose {plan.name}
                  </Button>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="mt-10 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Plans are not available yet. Please check back soon.
          </p>
        )}

        <section className="mt-6 flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold">Need a little more room?</h2>
            <p className="mt-1 text-sm text-muted-foreground">Buy a one-time credit top-up.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={topupCredits}
              onChange={(event) => setTopupCredits(event.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              aria-label="Top-up credits"
              className="h-10 w-28 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-accent"
            />
            <Button
              variant="outline"
              onClick={() => buy({ topupCredits: Number(topupCredits) }, "topup")}
              disabled={busy !== null || Number(topupCredits) <= 0}
            >
              {busy === "topup" && <Loader2 className="animate-spin" />}
              Buy credits
            </Button>
          </div>
        </section>

        {!ready && <p className="mt-5 text-xs text-muted-foreground">Checking your account…</p>}
        {!session && ready && (
          <p className="mt-5 text-xs text-muted-foreground">
            Sign in from the <Link to="/" className="font-medium text-foreground underline">home page</Link> to purchase.
          </p>
        )}
      </main>
    </div>
  );
}
