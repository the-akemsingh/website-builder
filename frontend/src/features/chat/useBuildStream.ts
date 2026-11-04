import { useEffect, useReducer } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, type BuildEvent, type ChatMessage, type ConnState } from "@/lib/api";
import { billingKey } from "@/features/billing/billing";

export type ChatItem =
  | { kind: "user" | "ai"; text: string; credits?: number | undefined }
  | { kind: "tool"; text: string; detail?: string | undefined }
  | { kind: "log"; text: string };

type State = {
  items: ChatItem[];
  status: "idle" | "building" | "ready" | "error";
  streaming: boolean;
  previewUrl?: string | undefined;
  error?: string | undefined;
  conn: ConnState;
};
type Action =
  | { t: "event"; e: BuildEvent }
  | { t: "conn"; c: ConnState }
  | { t: "reset"; history: ChatMessage[]; previewUrl?: string | undefined; initialPrompt?: string | undefined }
  | { t: "user"; text: string };

function reducer(s: State, a: Action): State {
  switch (a.t) {
    case "reset":
      return {
        ...s,
        items: [
          ...a.history.map((m) => ({ kind: m.role === "user" ? "user" : "ai", text: m.content } as ChatItem)),
          ...(a.initialPrompt ? [{ kind: "user" as const, text: a.initialPrompt }] : []),
        ],
        previewUrl: a.previewUrl,
        status: a.initialPrompt ? "building" : a.previewUrl ? "ready" : s.status,
      };
    case "conn":
      return { ...s, conn: a.c };
    case "user":
      return { ...s, items: [...s.items, { kind: "user", text: a.text }], status: "building", error: undefined };
    case "event": {
      const e = a.e;
      switch (e.type) {
        case "message":
          return { ...s, streaming: e.role === "assistant", items: [...s.items, { kind: e.role === "user" ? "user" : "ai", text: e.content }] };
        case "token": {
          const items = [...s.items];
          const last = items[items.length - 1];
          if (last?.kind === "ai") items[items.length - 1] = { ...last, text: last.text + e.delta };
          else items.push({ kind: "ai", text: e.delta });
          return { ...s, items, streaming: true };
        }
        case "tool":
          return { ...s, items: [...s.items, { kind: "tool", text: e.name, detail: e.detail }] };
        case "log":
          return { ...s, items: [...s.items, { kind: "log", text: e.line }] };
        case "status":
          return { ...s, status: e.status };
        case "preview":
          return { ...s, previewUrl: e.url };
        case "usage": {
          const items = [...s.items];
          for (let i = items.length - 1; i >= 0; i--) {
            const it = items[i];
            if (it && it.kind === "ai") {
              items[i] = { ...it, credits: e.creditsUsed };
              break;
            }
          }
          return { ...s, items };
        }
        case "done":
          return { ...s, streaming: false, status: s.status === "building" ? "ready" : s.status };
        case "error":
          return { ...s, streaming: false, status: "error", error: e.message };
      }
    }
  }
  return s;
}

/** Mount only after history is loaded so live events append to it. */
export function useBuildStream(
  websiteId: string,
  history: ChatMessage[],
  previewUrl?: string,
  initialPrompt?: string,
) {
  const qc = useQueryClient();
  const [state, dispatch] = useReducer(
    reducer,
    { items: [], status: "idle", streaming: false, conn: "connecting" } as State,
    (s) => reducer(s, { t: "reset", history, previewUrl, initialPrompt }),
  );

  useEffect(() => {
    // React calls the returned value as the cleanup function; anything else
    // (e.g. a mixed-module/HMR swap) would crash with "n is not a function".
    const dispose = api.openBuildStream(
      websiteId,
      (e) => {
        if (e.type === "usage") {
          qc.setQueryData(billingKey, (old: { balance: number } | undefined) =>
            old ? { ...old, balance: e.balance } : old,
          );
        }
        dispatch({ t: "event", e });
      },
      (c) => dispatch({ t: "conn", c }),
      initialPrompt,
    );
    return typeof dispose === "function" ? dispose : undefined;
  }, [websiteId, qc, initialPrompt]);

  return {
    ...state,
    sendPrompt: (text: string) => {
      const prompt = text.trim();
      if (!prompt || state.status === "building" || state.conn !== "open") return false;
      if (!api.sendPrompt(websiteId, prompt)) return false;
      dispatch({ t: "user", text: prompt });
      return true;
    },
  };
}
