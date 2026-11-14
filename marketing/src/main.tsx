import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ArrowRight, Check } from "lucide-react";
import { Accordion } from "./components/Accordion";
import { Footer } from "./components/Footer";
import { MarketingNav } from "./components/MarketingNav";
import { signInUrl } from "@/lib/app-url";
import "./styles.css";

const faq = [
  { q: "How do credits work?", a: "Every build or change uses credits based on how much work the agent does. You see the cost after each response and your balance updates live." },
  { q: "Can I get a refund?", a: "Unused top-up credits can be refunded within 14 days of purchase. Subscription months already started are not refunded." },
  { q: "How do I cancel?", a: "Cancel any time from billing. Your plan stays active until the end of the current period, then you move to Free." },
  { q: "Who owns the generated sites?", a: "You do. Everything the agent generates for you is yours to use, edit and publish commercially." },
];

const demos = [
  { tag: "Cafe", title: "Coffee Cartel", desc: "A specialty roaster with a menu, locations and a loyalty signup." },
  { tag: "Portfolio", title: "Studio Mica", desc: "A ceramicist's portfolio with a shop and workshop bookings." },
  { tag: "SaaS", title: "Ledgerline", desc: "Product landing page with pricing and a docs section." },
];

function Home() {
  return (
    <div className="min-h-screen">
      <MarketingNav />
      <main>
        <section className="mx-auto max-w-6xl px-6 pb-24 pt-16 text-center sm:pt-24">
          <h1 className="display text-5xl sm:text-7xl md:text-8xl">Describe it.<br />We'll build it.</h1>
          <p className="mx-auto mt-6 max-w-xl text-lg">Tell the agent what you need. Watch it write, build and preview your website in real time.</p>
          <div className="mx-auto mt-10 flex max-w-3xl justify-center">
            <a href={signInUrl} className="btn btn-primary"><ArrowRight className="size-4" aria-hidden />Get started</a>
          </div>
          <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
            {["Free credits to start", "You own everything it builds"].map((text) => <li key={text} className="flex items-center gap-2"><Check className="size-4" strokeWidth={1.5} aria-hidden />{text}</li>)}
          </ul>
        </section>
        <section className="mx-auto max-w-6xl scroll-mt-24 px-6 pb-24" aria-labelledby="demos-heading">
          <h2 id="demos-heading" className="display text-4xl sm:text-5xl">Built with Sitewright</h2>
          <p className="mt-3 max-w-xl">Real sites the agent put together from a single sentence.</p>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{demos.map((demo) => <li key={demo.title} className="panel flex flex-col gap-3 p-6"><span className="chip-accent w-fit">{demo.tag}</span><h3 className="text-xl font-semibold">{demo.title}</h3><p className="text-body">{demo.desc}</p></li>)}</ul>
        </section>
        <section id="faq" className="mx-auto grid max-w-6xl gap-10 px-6 py-24 md:grid-cols-2" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="display text-4xl sm:text-5xl">Questions,<br />answered.</h2><Accordion items={faq} />
        </section>
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="rounded-[28px] bg-accent px-8 py-16 text-center sm:py-24">
            <h2 className="display mx-auto max-w-2xl text-4xl text-ink sm:text-6xl">Your next website is one sentence away.</h2>
            <a href={signInUrl} className="btn btn-ink mt-10">Sign up</a>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><Home /></StrictMode>);
