import { useCallback, useEffect, useRef, useState } from "react";
import { WS_URL } from "@/lib/api";
import type { FeedItem, ServerEvent, SessionState } from "@/lib/types";

let counter = 0;
const nextId = () => `${Date.now()}-${counter++}`;

interface Options {
  websiteId: string | null;
  initialPrompt?: string | null;
  onFinal?: () => void;
}

export function useBuildSession({ websiteId, initialPrompt, onFinal }: Options) {
  const socketRef = useRef<WebSocket | null>(null);
  const pendingPrompt = useRef<string | null>(initialPrompt ?? null);
  const initialPromptSent = useRef(false);
  const finalHandler = useRef(onFinal);
  finalHandler.current = onFinal;

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [state, setState] = useState<SessionState>("idle");
  const [connected, setConnected] = useState(false);
  const [closedInvalid, setClosedInvalid] = useState(false);
  const [nonce, setNonce] = useState(0);

  const append = useCallback((item: FeedItem) => {
    setFeed((prev) => [...prev, item]);
  }, []);

  const seedFeed = useCallback(
    (items: FeedItem[]) =>
      setFeed((prev) => {
        const seededIds = new Set(items.map((item) => item.id));
        return [...items, ...prev.filter((item) => !seededIds.has(item.id))];
      }),
    [],
  );

  useEffect(() => {
    if (!websiteId) return;

    initialPromptSent.current = false;
    setState("connecting");
    setClosedInvalid(false);
    const socket = new WebSocket(`${WS_URL}/?websiteId=${encodeURIComponent(websiteId)}`);
    socketRef.current = socket;

    socket.onopen = () => {
      setConnected(true);
      setState("idle");
      const prompt = pendingPrompt.current;
      if (prompt && !initialPromptSent.current) {
        initialPromptSent.current = true;
        pendingPrompt.current = null;
        append({ kind: "user", id: nextId(), text: prompt });
        setState("ai_processing");
        socket.send(JSON.stringify({ type: "chat", prompt }));
      }
    };

    socket.onmessage = (raw) => {
      let event: ServerEvent;
      try {
        event = JSON.parse(String(raw.data)) as ServerEvent;
      } catch {
        return;
      }

      if (event.type === "log") {
        setState("ai_processing");
        append({ kind: "log", id: nextId(), text: event.message });
      } else if (event.type === "toolStart") {
        setState("running_tool");
        append({ kind: "tool", id: nextId(), tool: event.tool, status: "running", live: true });
      } else if (event.type === "toolEnd") {
        setState("ai_processing");
        setFeed((prev) => {
          const next = [...prev];
          for (let i = next.length - 1; i >= 0; i--) {
            const item = next[i];
            if (item && item.kind === "tool" && item.tool === event.tool && item.status === "running") {
              next[i] = {
                ...item,
                status: event.error ? "failed" : "done",
                detail: event.error ?? event.result,
              };
              return next;
            }
          }
          next.push({
            kind: "tool",
            id: nextId(),
            tool: event.tool,
            status: event.error ? "failed" : "done",
            live: true,
            detail: event.error ?? event.result,
          });
          return next;
        });
      } else if (event.type === "final") {
        setState("completed");
        append({ kind: "model", id: nextId(), text: event.response });
        setNonce(Date.now());
        finalHandler.current?.();
      } else if (event.type === "error") {
        setState("error");
        append({ kind: "error", id: nextId(), text: event.message });
      }
    };

    socket.onclose = (event) => {
      setConnected(false);
      if (event.code === 1008) {
        setClosedInvalid(true);
        setState("error");
      } else {
        setState((prev) => (prev === "completed" ? prev : "connection_lost"));
      }
    };

    socket.onerror = () => {
      setConnected(false);
    };

    return () => {
      socket.onclose = null;
      socket.close();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [websiteId, append]);

  const busy = state === "ai_processing" || state === "running_tool" || state === "connecting";

  const sendPrompt = useCallback(
    (prompt: string) => {
      const value = prompt.trim();
      const socket = socketRef.current;
      if (!value || busy) return false;
      if (!socket || socket.readyState !== WebSocket.OPEN) return false;
      append({ kind: "user", id: nextId(), text: value });
      setState("ai_processing");
      socket.send(JSON.stringify({ type: "chat", prompt: value }));
      return true;
    },
    [append, busy],
  );

  return { feed, seedFeed, state, busy, connected, closedInvalid, sendPrompt, nonce };
}
