import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";

const cols = [
  { h: "Product", links: [{ label: "Pricing", to: "/pricing" }, { label: "My websites", to: "/app" }] },
  { h: "Resources", links: [{ label: "FAQ", to: "/" }, { label: "Get started", to: "/" }] },
  { h: "Company", links: [{ label: "Terms", to: "/" }, { label: "Privacy", to: "/" }] },
] as const;

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-2">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm">Describe a website. Get a website.</p>
        </div>
        <div className="grid grid-cols-3 gap-6">
          {cols.map((c) => (
            <div key={c.h}>
              <h3 className="text-sm font-semibold">{c.h}</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <Link to={l.to} className="hover:text-foreground">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
