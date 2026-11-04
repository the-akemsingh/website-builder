import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { api, DEMO, sessionStore, type User } from "@/lib/api";

const GOOGLE_CLIENT_ID = import.meta.env["VITE_GOOGLE_CLIENT_ID"] as string | undefined;

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential?: string }) => void }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

type Status = "loading" | "authed" | "anon";
type AuthCtx = {
  user: User | null;
  status: Status;
  signIn: () => void;
  signOut: () => Promise<void>;
  completeSignIn: (token: string) => Promise<void>;
};
const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [signInOpen, setSignInOpen] = useState(false);
  const qc = useQueryClient();

  // The session (JWT + user) lives in localStorage; restoring it needs no network call.
  const load = useCallback(async () => {
    const s = sessionStore.get();
    if (s?.user) {
      setUser(s.user);
      setStatus("authed");
    } else {
      setUser(null);
      setStatus("anon");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const signIn = useCallback(() => {
    if (DEMO) {
      window.location.href = "/auth/callback?token=demo";
      return;
    }
    setSignInOpen(true);
  }, []);

  const signOut = useCallback(async () => {
    await api.signOut();
    setUser(null);
    setStatus("anon");
    qc.clear();
  }, [qc]);

  const completeSignIn = useCallback(
    async (token: string) => {
      // Demo mode mints its own session here; real sign-in stores the JWT in the Google dialog.
      if (DEMO) sessionStore.set(token, await api.me());
      await load();
    },
    [load],
  );

  const value: AuthCtx = { user, status, signIn, signOut, completeSignIn };

  return (
    <Ctx.Provider value={value}>
      {children}
      {!DEMO && (
        <GoogleDialog
          open={signInOpen}
          onClose={() => setSignInOpen(false)}
          onSignedIn={(u) => {
            setUser(u);
            setStatus("authed");
          }}
        />
      )}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}

/** Google Identity Services button in a modal; the ID token is exchanged for a backend JWT. */
function GoogleDialog({ open, onClose, onSignedIn }: { open: boolean; onClose: () => void; onSignedIn: (u: User) => void }) {
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const btnRef = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const qc = useQueryClient();

  const handleCredential = useCallback(
    async (response: { credential?: string }) => {
      const idToken = response.credential;
      if (!idToken || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setError(false);
      try {
        const { token, user } = await api.signInWithGoogle(idToken);
        sessionStore.set(token, user);
        onSignedIn(user);
        onClose();
      } catch {
        setError(true);
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [onClose, onSignedIn],
  );

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setError(false);
    const init = () => {
      const g = window.google;
      if (!g?.accounts?.id) return;
      g.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID as string, callback: (r) => void handleCredential(r) });
      if (btnRef.current) {
        g.accounts.id.renderButton(btnRef.current, { theme: "outline", size: "large", shape: "pill", text: "continue_with", width: 300 });
      }
    };
    if (window.google?.accounts?.id) {
      init();
      return;
    }
    if (!document.getElementById("google-gsi-script")) {
      const s = document.createElement("script");
      s.id = "google-gsi-script";
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = init;
      document.head.appendChild(s);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <dialog
      ref={dialog}
      onClose={() => onClose()}
      aria-labelledby="google-signin-title"
      className="panel relative m-auto w-[min(92vw,420px)] p-8 text-center backdrop:bg-ink/80"
    >
      <button className="icon-btn absolute right-4 top-4" onClick={() => onClose()} aria-label="Close">
        <X className="size-4" />
      </button>
      <h2 id="google-signin-title" className="display text-2xl">Sign in to Sitewright</h2>
      <p className="mt-2 text-sm text-body">Your websites and credits live in your account.</p>
      <div className="mt-6 flex min-h-12 items-center justify-center">
        {busy ? (
          <span className="flex items-center gap-2 text-sm" role="status">
            <Loader2 className="size-4 animate-spin" />Signing you in…
          </span>
        ) : (
          <div ref={btnRef} aria-label="Sign in with Google" />
        )}
      </div>
      {!GOOGLE_CLIENT_ID && (
        <p className="mt-4 text-sm text-danger" role="alert">
          Google sign-in isn't configured yet. Add a Google OAuth client ID (VITE_GOOGLE_CLIENT_ID) to enable it.
        </p>
      )}
      {error && (
        <p className="mt-4 text-sm text-danger" role="alert">
          Sign-in failed. Check the Google account you chose and try again.
        </p>
      )}
    </dialog>
  );
}
