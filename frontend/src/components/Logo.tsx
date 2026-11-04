import { Link } from "@tanstack/react-router";
import { BRAND } from "@/lib/brand";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 rounded-full font-semibold text-foreground" aria-label={`${BRAND} home`}>
      <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-accent text-sm font-bold text-ink">
        {BRAND[0]}
      </span>
      <span className="text-lg tracking-tight">{BRAND}</span>
    </Link>
  );
}
