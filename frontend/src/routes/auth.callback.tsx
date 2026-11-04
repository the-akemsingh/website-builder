import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth";

export const Route = createFileRoute("/auth/callback")({
  validateSearch: (s: Record<string, unknown>) => ({ token: typeof s["token"] === "string" ? s["token"] : undefined }),
  head: () => ({ meta: [{ title: "Signing in — Sitewright" }, { name: "robots", content: "noindex" }] }),
  component: Callback,
});

function Callback() {
  const { token } = Route.useSearch();
  const { completeSignIn } = useAuth();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Backend may set a session cookie instead of returning ?token — "cookie" is a placeholder token then.
    completeSignIn(token ?? "cookie")
      .then(() => navigate({ to: "/", replace: true }))
      .catch(() => setFailed(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 text-center" role="status">
      {failed ? <p className="text-danger">Sign-in failed. <a className="underline" href="/">Go back</a></p> : <p>Signing you in…</p>}
    </main>
  );
}
