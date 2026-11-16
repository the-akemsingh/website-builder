import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "@/features/auth/auth";
import { CreditsChip } from "@/features/billing/billing";

function Announcement() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(localStorage.getItem("sw_announce") !== "off");
  }, []);
  if (!show) return null;
  return (
    <div className="relative bg-accent px-10 py-2 text-center text-sm font-medium text-ink">
      New: describe a change in chat and watch your site rebuild live.
      <button
        className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-ink"
        aria-label="Dismiss announcement"
        onClick={() => {
          localStorage.setItem("sw_announce", "off");
          setShow(false);
        }}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function AvatarMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const avatarInitial = (
    user?.name.trim().charAt(0) ||
    user?.email.trim().charAt(0) ||
    "?"
  ).toUpperCase();
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  useEffect(() => {
    setImageFailed(false);
  }, [user?.avatarUrl]);
  if (!user) return null;
  return (
    <div ref={ref} className="relative" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
      <button
        className="grid size-9 place-items-center overflow-hidden rounded-full bg-surface-2 text-sm font-semibold text-foreground"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((o) => !o)}
      >
        {user.avatarUrl && !imageFailed ? (
          <img
            src={user.avatarUrl}
            alt=""
            className="size-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          avatarInitial
        )}
      </button>
      {open && (
        <div role="menu" className="panel absolute right-0 top-11 z-20 w-56 p-2 text-sm">
          <p className="truncate px-3 py-2 text-body">{user.email}</p>
          <Link
            role="menuitem"
            to="/app"
            className="block rounded-xl px-3 py-2 text-foreground hover:bg-surface-2"
          >
            My websites
          </Link>
          <button
            role="menuitem"
            onClick={signOut}
            className="block w-full rounded-xl px-3 py-2 text-left text-foreground hover:bg-surface-2"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function SiteNav({ announce = false }: { announce?: boolean }) {
  const { status } = useAuth();
  return (
    <>
      {announce && <Announcement />}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <nav className="flex items-center gap-2 sm:gap-4" aria-label="Primary">
            <Logo />
            <Link
              to="/pricing"
              className="rounded-full px-2 text-sm font-medium text-body hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              Pricing
            </Link>
          </nav>
          <nav className="flex items-center gap-2 sm:gap-3" aria-label="Main">
            <ThemeToggle />
            {status === "authed" ? (
              <>
                <span className="hidden sm:inline-flex">
                  <CreditsChip />
                </span>
                <AvatarMenu />
              </>
            ) : (
              <Link to="/signin" className="btn btn-primary py-2">
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>
    </>
  );
}
