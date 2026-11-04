import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Coins, X } from "lucide-react";
import { api, type CheckoutBody } from "@/lib/api";
import { pendingPrompt, type PendingPrompt } from "@/lib/brand";
import { useAuth } from "@/features/auth/auth";

export const billingKey = ["billing", "me"] as const;

export function useBillingMe() {
  const { status } = useAuth();
  return useQuery({ queryKey: billingKey, queryFn: api.billingMe, enabled: status === "authed" });
}

export function useCheckout() {
  return useMutation({
    mutationFn: (body: CheckoutBody) => api.checkout(body),
    onSuccess: ({ checkoutUrl }) => {
      window.location.href = checkoutUrl;
    },
  });
}

export function CreditsChip() {
  const { data, isLoading } = useBillingMe();
  return (
    <Link to="/pricing" className="chip-accent" aria-label={`${data?.balance ?? 0} credits, view plans`}>
      <Coins className="size-3.5" strokeWidth={2} aria-hidden />
      {isLoading ? "…" : `${data?.balance ?? 0} credits`}
    </Link>
  );
}

// ----- Out of credits modal -----
const TOPUP = 200;
const Ctx = createContext<(p: PendingPrompt) => void>(() => {});
export const useOutOfCredits = () => useContext(Ctx);

export function OutOfCreditsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const checkout = useCheckout();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const show = (p: PendingPrompt) => {
    pendingPrompt.set(p);
    setOpen(true);
  };

  return (
    <Ctx.Provider value={show}>
      {children}
      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        aria-labelledby="ooc-title"
        className="panel m-auto w-[min(92vw,440px)] p-8 text-body backdrop:bg-ink/80"
      >
        <button className="icon-btn absolute right-4 top-4" onClick={() => setOpen(false)} aria-label="Close">
          <X className="size-4" />
        </button>
        <h2 id="ooc-title" className="display text-3xl">You're out of credits</h2>
        <p className="mt-3">Your prompt is saved. Upgrade or top up, then pick up right where you left off.</p>
        {checkout.isError && <p className="mt-3 text-danger" role="alert">Checkout failed. Please try again.</p>}
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/pricing" className="btn btn-primary" onClick={() => setOpen(false)}>
            Upgrade
          </Link>
          <button
            className="btn btn-secondary"
            disabled={checkout.isPending}
            onClick={() => checkout.mutate({ topupCredits: TOPUP })}
          >
            {checkout.isPending ? "Opening checkout…" : `Buy ${TOPUP} credits`}
          </button>
        </div>
      </dialog>
    </Ctx.Provider>
  );
}
