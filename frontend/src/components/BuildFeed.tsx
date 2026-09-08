import { useEffect, useRef } from "react";
import { ChevronRight, Loader2, TriangleAlert, Wrench } from "lucide-react";
import type { FeedItem } from "@/lib/types";

function ToolRow({ item }: { item: Extract<FeedItem, { kind: "tool" }> }) {
  return (
    <div className="flex items-center gap-2 text-xs text-panel-muted">
      <div className="flex items-center gap-2">
        {item.live && item.status === "running" ? (
          <Loader2 className="size-3.5 animate-spin text-accent" />
        ) : (
          <Wrench className="size-3.5" />
        )}
        <span>{item.live && item.status === "running" ? "Working with" : "Used"} {item.tool}</span>
      </div>
    </div>
  );
}

export function BuildFeed({ items, busy }: { items: FeedItem[]; busy: boolean }) {
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items.length, busy]);

  return (
    <div className="panel-scroll flex-1 space-y-3 overflow-y-auto px-5 py-6">
      {items.length === 0 && (
        <p className="text-sm text-panel-muted">
          No messages yet. Send a prompt to start building.
        </p>
      )}

      {items.map((item) => {
        if (item.kind === "user") {
          return (
            <div key={item.id} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-accent px-4 py-2.5 text-sm text-accent-foreground">
                {item.text}
              </p>
            </div>
          );
        }
        if (item.kind === "model") {
          return (
            <p
              key={item.id}
              className="whitespace-pre-wrap text-sm leading-relaxed text-panel-foreground"
            >
              {item.text}
            </p>
          );
        }
        if (item.kind === "log") {
          return (
            <p key={item.id} className="flex items-start gap-1.5 text-xs text-panel-muted">
              <ChevronRight className="mt-0.5 size-3 shrink-0 text-accent" />
              <span>{item.text}</span>
            </p>
          );
        }
        if (item.kind === "tool") return <ToolRow key={item.id} item={item} />;
        return (
          <p
            key={item.id}
            className="flex items-start gap-2 rounded-xl border border-destructive/40 px-3 py-2 text-sm text-destructive"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>{item.text}</span>
          </p>
        );
      })}

      {busy && (
        <p className="flex items-center gap-2 text-xs text-panel-muted">
          <Loader2 className="size-3.5 animate-spin text-accent" /> Working…
        </p>
      )}
      <div ref={end} />
    </div>
  );
}
