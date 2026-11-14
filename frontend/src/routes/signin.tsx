import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/features/auth/auth";

export const Route = createFileRoute("/signin")({
  head: () => ({ meta: [{ title: "Sign in — Sitewright" }, { name: "robots", content: "noindex" }] }),
  component: SignIn,
});

function SignIn() {
  const { status, signIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "authed") void navigate({ to: "/app", replace: true });
  }, [navigate, status]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 text-center">
      <div className="panel w-full max-w-md p-8">
        <h1 className="display text-4xl">Sign in to Sitewright</h1>
        <p className="mt-3">Your websites and credits live in your account.</p>
        <button className="btn btn-primary mt-8" onClick={signIn} disabled={status === "loading"}>
          Continue with Google
        </button>
      </div>
    </main>
  );
}
