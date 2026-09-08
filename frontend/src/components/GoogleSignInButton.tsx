import { useEffect, useRef, useState } from "react";
import { loginWithGoogle } from "@/lib/api";
import { useAuth } from "@/lib/auth";

declare global {
  interface Window {
    google?: any;
  }
}

const CLIENT_ID = import.meta.env["VITE_GOOGLE_CLIENT_ID"] as string | undefined;

export function GoogleSignInButton({ onSignedIn }: { onSignedIn?: () => void }) {
  const holder = useRef<HTMLDivElement>(null);
  const { signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID) return;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      if (!window.google || !holder.current) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: async (response: { credential: string }) => {
          setBusy(true);
          setError(null);
          try {
            const login = await loginWithGoogle(response.credential);
            signIn(login);
            onSignedIn?.();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Sign-in failed.");
          } finally {
            setBusy(false);
          }
        },
      });
      window.google.accounts.id.renderButton(holder.current, {
        theme: "filled_black",
        size: "large",
        shape: "pill",
        text: "continue_with",
      });
    };
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, [signIn, onSignedIn]);

  if (!CLIENT_ID) {
    return (
      <p className="max-w-sm text-sm text-muted-foreground">
        Google sign-in isn't set up yet. Add your Google client ID as{" "}
        <code className="font-mono text-accent">VITE_GOOGLE_CLIENT_ID</code> to enable the
        sign-in button.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div ref={holder} />
      {busy && <p className="text-sm text-muted-foreground">Signing you in…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
