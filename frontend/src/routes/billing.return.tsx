import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { getBillingMe } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { noIndexHead } from "@/lib/seo";

export const Route = createFileRoute("/billing/return")({
  validateSearch: (search: Record<string, unknown>): {
    orderId?: string;
    websiteId?: string;
    prompt?: string;
  } => {
    const result: { orderId?: string; websiteId?: string; prompt?: string } = {};
    if (typeof search["orderId"] === "string") result.orderId = search["orderId"];
    if (typeof search["websiteId"] === "string") result.websiteId = search["websiteId"];
    if (typeof search["prompt"] === "string") result.prompt = search["prompt"];
    return result;
  },
  head: () => ({
    meta: [{ title: "Confirming payment — Forge" }, ...noIndexHead.meta],
  }),
  component: BillingReturn,
});

function BillingReturn() {
  const { orderId, websiteId, prompt } = Route.useSearch();
  const { session, ready } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      navigate({ to: "/" });
      return;
    }

    let active = true;
    let attempts = 0;
    const poll = async () => {
      try {
        const billing = await getBillingMe(session.token);
        const order = orderId && billing.latestOrder?.id === orderId ? billing.latestOrder : null;
        if (order?.status === "paid") {
          if (websiteId) {
            navigate({
              to: "/workspace/$websiteId",
              params: { websiteId },
              search: { prompt },
            });
          } else {
            navigate({ to: "/", search: prompt ? { prompt } : {} });
          }
          return;
        }
        if (order?.status === "failed") {
          setError("Payment was not completed.");
          return;
        }
        attempts += 1;
        if (active && attempts < 30) window.setTimeout(poll, 1500);
        else if (active) setError("Payment confirmation is taking longer than expected.");
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Couldn't confirm payment.");
      }
    };
    poll();
    return () => {
      active = false;
    };
  }, [navigate, orderId, prompt, ready, session, websiteId]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 text-center">
        {error ? (
          <>
            <h1 className="text-2xl font-bold">Payment needs attention</h1>
            <p className="mt-3 text-sm text-muted-foreground">{error}</p>
            <Button className="mt-6" onClick={() => navigate({ to: "/pricing" })}>
              Back to plans
            </Button>
          </>
        ) : (
          <>
            <Loader2 className="size-6 animate-spin text-accent" />
            <h1 className="mt-5 text-2xl font-bold">Confirming your payment</h1>
            <p className="mt-3 text-sm text-muted-foreground">We’re checking the order status with Forge.</p>
          </>
        )}
      </main>
    </div>
  );
}
