import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { pendingPrompt } from "@/lib/brand";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { billingKey } from "@/features/billing/billing";

export const Route = createFileRoute("/billing/return")({
  head: () => ({ meta: [{ title: "Confirming payment — Sitewright" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <RequireAuth>
      <Return />
    </RequireAuth>
  ),
});

const TIMEOUT_MS = 90_000;

function Return() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [started] = useState(() => Date.now());
  const timedOut = Date.now() - started > TIMEOUT_MS;
  // The redirect itself proves nothing — poll until the backend says the order is paid.
  const q = useQuery({
    queryKey: ["billing", "return"],
    queryFn: api.billingMe,
    refetchInterval: (query) => {
      const s = query.state.data?.latestOrder?.status;
      return s === "paid" || s === "failed" || Date.now() - started > TIMEOUT_MS ? false : 2000;
    },
  });
  const status = q.data?.latestOrder?.status;

  useEffect(() => {
    if (status !== "paid") return;
    qc.setQueryData(billingKey, q.data);
    const p = pendingPrompt.get();
    if (p?.websiteId) navigate({ to: "/app/$websiteId", params: { websiteId: p.websiteId }, replace: true });
    else navigate({ to: "/app", search: { paid: true }, replace: true });
  }, [status, q.data, qc, navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 text-center">
      <div className="max-w-sm" role="status">
        {status === "failed" ? (
          <>
            <h1 className="display text-3xl">Payment didn't go through</h1>
            <p className="mt-3">You weren't charged. You can try again from pricing.</p>
            <Link to="/pricing" className="btn btn-primary mt-6">Back to pricing</Link>
          </>
        ) : timedOut || q.isError ? (
          <>
            <h1 className="display text-3xl">Still confirming</h1>
            <p className="mt-3">This is taking longer than usual. Your credits will appear once the payment clears.</p>
            <Link to="/app" className="btn btn-secondary mt-6">Go to my websites</Link>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto size-6 animate-spin text-foreground" />
            <h1 className="display mt-4 text-3xl">Confirming your payment…</h1>
          </>
        )}
      </div>
    </main>
  );
}
