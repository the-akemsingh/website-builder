import type { ReactNode } from "react";
import { useAuth } from "./auth";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, signIn } = useAuth();
  if (status === "loading")
    return (
      <div className="mx-auto max-w-6xl px-6 py-16" aria-busy="true">
        <div className="skeleton h-10 w-60" />
        <div className="skeleton mt-6 h-40 w-full" />
      </div>
    );
  if (status === "anon")
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="display text-4xl">Sign in to continue</h1>
        <p className="mt-3">Your websites and credits live in your account.</p>
        <button className="btn btn-primary mt-8" onClick={signIn}>
          Continue with Google
        </button>
      </main>
    );
  return <>{children}</>;
}
