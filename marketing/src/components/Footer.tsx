import { Logo } from "./Logo";
import { signInUrl } from "@/lib/app-url";

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-2">
        <div><Logo /><p className="mt-3 max-w-xs text-sm">Describe a website. Get a website.</p></div>
        <div className="grid grid-cols-3 gap-6 text-sm">
          <div><h3 className="font-semibold">Product</h3><a className="mt-3 block hover:text-foreground" href={signInUrl}>Get started</a></div>
          <div><h3 className="font-semibold">Resources</h3><a className="mt-3 block hover:text-foreground" href="#faq">FAQ</a></div>
          <div><h3 className="font-semibold">Account</h3><a className="mt-3 block hover:text-foreground" href={signInUrl}>Sign in</a></div>
        </div>
      </div>
    </footer>
  );
}
