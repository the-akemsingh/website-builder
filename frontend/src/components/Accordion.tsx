import { useId, useState } from "react";
import { Plus } from "lucide-react";

export function Accordion({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const base = useId();
  return (
    <div className="border-t">
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <div key={it.q} className="border-b">
            <h3>
              <button
                id={`${base}-b${i}`}
                aria-expanded={isOpen}
                aria-controls={`${base}-p${i}`}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-6 rounded-xl py-5 text-left text-lg font-medium text-foreground"
              >
                {it.q}
                <Plus className={`size-5 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-45" : ""}`} strokeWidth={1.5} aria-hidden />
              </button>
            </h3>
            <div
              id={`${base}-p${i}`}
              role="region"
              aria-labelledby={`${base}-b${i}`}
              className={`grid transition-all duration-200 ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
            >
              <p className="overflow-hidden pb-0 pr-10 [&]:mb-5">{it.a}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
