import { Logo } from "./Logo";
import { signInUrl } from "@/lib/app-url";

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <nav className="flex items-center gap-4" aria-label="Primary">
          <Logo />
          <a href="#faq" className="rounded-full px-2 text-sm font-medium text-body hover:text-foreground">FAQ</a>
        </nav>
        <a href={signInUrl} className="btn btn-primary py-2">Sign in</a>
      </div>
    </header>
  );
}
