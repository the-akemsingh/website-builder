import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "./auth";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (status === "anon") void navigate({ to: "/signin", replace: true });
  }, [navigate, status]);
  if (status === "loading")
    return (
      <div className="mx-auto max-w-6xl px-6 py-16" aria-busy="true">
        <div className="skeleton h-10 w-60" />
        <div className="skeleton mt-6 h-40 w-full" />
      </div>
    );
  if (status === "anon") return <main className="min-h-[40vh]" role="status">Redirecting to sign in…</main>;
  return <>{children}</>;
}
