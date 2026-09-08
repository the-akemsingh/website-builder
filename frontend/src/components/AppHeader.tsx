import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AppHeader({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { session, signOut } = useAuth();
  const dark = tone === "dark";

  return (
    <header
      className={cn(
        "flex items-center justify-between border-b px-5 py-3",
        dark ? "border-panel-border bg-panel" : "border-border bg-background",
      )}
    >
      <Link to="/" className="flex items-center gap-2">
        <span className="size-3 rounded-full bg-accent" />
        <span
          className={cn(
            "text-sm font-bold tracking-tight",
            dark ? "text-panel-foreground" : "text-foreground",
          )}
        >
          Forge
        </span>
      </Link>

      <nav className="flex items-center gap-2">
        {session && (
          <Button asChild variant={dark ? "pillOutline" : "quiet"} size="pillSm">
            <Link to="/projects">Projects</Link>
          </Button>
        )}
        {session && (
          <>
            <span
              className={cn(
                "hidden text-xs sm:inline",
                dark ? "text-panel-muted" : "text-muted-foreground",
              )}
            >
              {session.user.email}
            </span>
            <Button variant={dark ? "pillOutline" : "quiet"} size="pillSm" onClick={signOut}>
              Sign out
            </Button>
          </>
        )}
      </nav>
    </header>
  );
}
