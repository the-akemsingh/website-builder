export function Logo() {
  return (
    <a href="/" className="flex items-center gap-2 rounded-full font-semibold text-foreground" aria-label="Sitewright home">
      <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-accent text-sm font-bold text-ink">S</span>
      <span className="text-lg tracking-tight">Sitewright</span>
    </a>
  );
}
