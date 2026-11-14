import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import "highlight.js/styles/github-dark.css";
import { ArrowUp, Check, CheckCircle2, ChevronRight, Copy, ExternalLink, Loader2, RotateCw, Terminal, Wrench } from "lucide-react";
import { type WebsiteDetail } from "@/lib/api";
import { pendingPrompt } from "@/lib/brand";
import { useBuildStream, type ChatItem } from "./useBuildStream";

export function Workspace({
  websiteId,
  detail,
  initialPrompt,
}: {
  websiteId: string;
  detail: WebsiteDetail;
  initialPrompt?: string | undefined;
}) {
  const stream = useBuildStream(websiteId, detail.messages, detail.website.previewUrl, initialPrompt);
  const [tab, setTab] = useState<"chat" | "preview">("chat");

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 p-3 pt-0">
      <div role="tablist" aria-label="Workspace view" className="flex gap-1 self-center rounded-full border p-1 md:hidden">
        {(["chat", "preview"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors duration-150 ${tab === t ? "bg-paper text-ink" : "text-body"}`}>
            {t}
          </button>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-[minmax(320px,2fr)_3fr]">
        <section aria-label="Chat" className={`panel min-h-0 flex-col ${tab === "chat" ? "flex" : "hidden"} md:flex`}>
          <Chat websiteId={websiteId} stream={stream} />
        </section>
        <section aria-label="Preview" className={`panel min-h-0 flex-col overflow-hidden ${tab === "preview" ? "flex" : "hidden"} md:flex`}>
          <Preview url={stream.previewUrl} status={stream.status} />
        </section>
      </div>
    </main>
  );
}

type Stream = ReturnType<typeof useBuildStream>;

function Chat({ websiteId, stream }: { websiteId: string; stream: Stream }) {
  const saved = pendingPrompt.get();
  const [text, setText] = useState(saved?.websiteId === websiteId ? saved.prompt : "");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [stream.items, stream.streaming]);

  const busy = stream.status === "building" || stream.conn !== "open";
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = text.trim();
    if (!p || busy) return;
    if (stream.sendPrompt(p)) {
      setText("");
      pendingPrompt.clear();
    }
  };

  return (
    <>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5" aria-live="polite">
        {stream.items.map((it, i) => <Item key={i} item={it} />)}
        {stream.status === "building" && !stream.streaming && (
          <p className="flex items-center gap-2 text-sm" role="status"><Loader2 className="size-4 animate-spin" />Working…</p>
        )}
        {stream.status === "ready" && stream.previewUrl && (
          <p className="flex items-center gap-1.5 text-xs text-body" role="status">
            <CheckCircle2 className="size-3.5 text-accent" aria-hidden />
            Build complete · Preview available
          </p>
        )}
        {stream.status === "error" && <p className="text-sm text-danger" role="alert">{stream.error ?? "The build failed."} Send a message to try again.</p>}
        {stream.conn === "reconnecting" && <p className="text-sm" role="status">Reconnecting…</p>}
        {stream.conn === "failed" && <p className="text-sm text-danger" role="alert">Lost connection to the build. Refresh the page to reconnect.</p>}
        <div ref={end} />
      </div>
      <form onSubmit={submit} className="m-3 mt-0 flex items-end gap-2 rounded-[22px] border bg-background p-2">
        <label htmlFor="chat-input" className="sr-only">Message the agent</label>
        <textarea id="chat-input" rows={2} value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submit(e)}
          placeholder="Ask for a change…"
          className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-3 py-2 text-foreground outline-none placeholder:text-body/60" />
        <button type="submit" className="btn btn-primary size-10 p-0" disabled={!text.trim() || busy} aria-label="Send">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
        </button>
      </form>
    </>
  );
}

function Item({ item }: { item: ChatItem }) {
  if (item.kind === "user")
    return <div className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-[18px] bg-surface-2 px-4 py-2.5 text-foreground">{item.text}</div>;
  if (item.kind === "ai")
    return (
      <div>
        <div className="chat-markdown text-foreground">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={{
              a: ({ children, ...props }) => <a {...props} target="_blank" rel="noreferrer">{children}</a>,
              code: ({ className, children, ...props }) => {
                const content = String(children).replace(/\n$/, "");
                const block = Boolean(className) || content.includes("\n");
                if (!block) return <code {...props}>{children}</code>;
                return (
                  <div className="chat-code">
                    <div className="chat-code-toolbar">
                      <span>{className?.replace("language-", "") || "code"}</span>
                      <CopyButton content={content} />
                    </div>
                    <pre><code className={className} {...props}>{content}</code></pre>
                  </div>
                );
              },
            }}
          >
            {item.text}
          </ReactMarkdown>
        </div>
        {item.credits != null && <p className="mt-1 text-xs">This build used {item.credits} credits</p>}
      </div>
    );
  const Icon = item.kind === "tool" ? Wrench : Terminal;
  return (
    <details className="group font-mono text-xs">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md py-0.5 hover:text-foreground">
        <ChevronRight className="size-3 transition-transform duration-150 group-open:rotate-90" aria-hidden />
        <Icon className="size-3" aria-hidden />
        <span className="truncate">{item.text}</span>
      </summary>
      <p className="ml-6 mt-1 break-all">{item.kind === "tool" ? item.detail ?? "No details" : item.text}</p>
    </details>
  );
}

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setCopyError(false);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopyError(true);
    }
  };

  return (
    <button type="button" className="chat-code-copy" onClick={copy} aria-label={copyError ? "Unable to copy code" : copied ? "Code copied" : "Copy code"}>
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copyError ? "Copy failed" : copied ? "Copied" : "Copy"}
    </button>
  );
}

function Preview({ url, status }: { url?: string | undefined; status: Stream["status"] }) {
  const [nonce, setNonce] = useState(0);
  const building = status === "building";
  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
        <p className="flex items-center gap-2 text-sm" role="status">
          {building ? <><Loader2 className="size-3.5 animate-spin" />Building…</> : url ? "Live preview" : "No preview yet"}
        </p>
        <div className="flex">
          <button className="icon-btn" onClick={() => setNonce((n) => n + 1)} disabled={!url} aria-label="Refresh preview"><RotateCw className="size-4" /></button>
          {url && <a className="icon-btn" href={url} target="_blank" rel="noreferrer" aria-label="Open preview in new tab"><ExternalLink className="size-4" /></a>}
        </div>
      </div>
      <div className="relative min-h-0 flex-1 bg-background">
        {url ? (
          <iframe key={nonce} src={url} title="Website preview" className={`size-full bg-paper transition-opacity duration-200 ${building ? "opacity-60" : ""}`} />
        ) : (
          <div className="space-y-4 p-6" aria-hidden>
            <div className="skeleton h-8 w-1/3" /><div className="skeleton h-48 w-full" />
            <div className="grid grid-cols-3 gap-4"><div className="skeleton h-24" /><div className="skeleton h-24" /><div className="skeleton h-24" /></div>
          </div>
        )}
      </div>
    </>
  );
}
