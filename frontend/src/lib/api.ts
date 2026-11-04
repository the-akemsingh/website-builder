/**
 * Single typed client for every backend call.
 * If the backend's shapes differ, fix them here — nothing else should know URLs.
 *
 * Set VITE_API_URL (e.g. http://localhost:4000) to talk to the real backend.
 * Without it the app runs in DEMO mode with an in-browser mock so every screen works.
 *
 * Backend contract:
 * - Google Identity Services ID token -> POST /auth/google/ -> backend JWT
 * - The JWT and user are stored together in localStorage under "forge.session"
 * - Protected HTTP sends Authorization: Bearer <jwt>; a 401 clears the session and returns home
 * - Build stream: WS <host>/api/v1/?websiteId=<id>&token=<jwt> (close code 1008 = rejected)
 * - New projects: POST /website { prompt } -> { websiteId, projectUrl }
 */

const API_URL = (import.meta.env["VITE_API_URL"] as string | undefined)?.replace(/\/$/, "");
export const DEMO = !API_URL;
const WS_URL = API_URL
  ? API_URL.replace(/^http/, "ws").replace(/\/api\/v1\/?$/, "")
  : "";

// ---------- Types ----------
export type User = { id: string; name: string; email: string; avatarUrl?: string | undefined };
export type BackendUser = { id: string; email: string; name: string; image?: string | undefined };
export type Website = {
  id: string;
  title: string;
  template: string;
  createdAt: string;
  previewUrl?: string | undefined;
};
export type ChatMessage = { role: "user" | "assistant"; content: string };
export type WebsiteDetail = { website: Website; messages: ChatMessage[] };
export type Plan = {
  key: string;
  label: string;
  name: string;
  priceMonthly: number;
  description: string;
  features: string[];
  recommended?: boolean | undefined;
};
export type OrderStatus = "pending" | "paid" | "failed";
export type BillingMe = {
  planKey: string;
  balance: number;
  latestOrder?: { id: string; status: OrderStatus } | undefined;
};
type BackendBillingPlan = {
  id: string;
  key: string;
  name: string;
  monthlyCredits: number;
  priceMinor: number;
  currency: string;
  interval: string;
};
export type CheckoutBody = { planKey: string } | { topupCredits: number };

export type BuildEvent =
  | { type: "message"; role: "user" | "assistant"; content: string }
  | { type: "token"; delta: string }
  | { type: "tool"; name: string; detail?: string | undefined }
  | { type: "log"; line: string }
  | { type: "status"; status: "building" | "ready" | "error" }
  | { type: "preview"; url: string }
  | { type: "refresh" }
  | { type: "usage"; creditsUsed: number; balance: number }
  | { type: "done" }
  | { type: "error"; message: string; code?: string | undefined; balance?: number | undefined };

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string | undefined,
  ) {
    super(message);
  }
}
export const isOutOfCredits = (e: unknown) =>
  e instanceof ApiError && e.code === "INSUFFICIENT_CREDITS";

// ---------- Session (localStorage "forge.session" = { token, user }) ----------
export type Session = { token: string; user: User };
const SESSION_KEY = "forge.session";
export const sessionStore = {
  get(): Session | null {
    if (typeof window === "undefined") return null;
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null");
      return s && typeof s.token === "string" && s.user ? (s as Session) : null;
    } catch {
      return null;
    }
  },
  set(token: string, user: User) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ token, user }));
  },
  clear() {
    localStorage.removeItem(SESSION_KEY);
  },
  token(): string | null {
    return this.get()?.token ?? null;
  },
};

// ---------- Last-known credit balance (kept client-side; the live number arrives on the socket) ----------
const BALANCE_KEY = "sw_balance";
export const cacheBalance = (balance: number) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BALANCE_KEY, String(balance));
  } catch {
    /* private mode */
  }
};
export const cachedBalance = () => {
  if (typeof window === "undefined") return 0;
  const n = Number(localStorage.getItem(BALANCE_KEY));
  return Number.isFinite(n) ? n : 0;
};

// ---------- HTTP ----------
async function request<T>(
  path: string,
  init: RequestInit = {},
  opts: { on401?: "redirect" | "throw" } = {},
): Promise<T> {
  const token = sessionStore.token();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) {
    // Session rejected: drop it and send the user back to the start.
    sessionStore.clear();
    if (opts.on401 !== "throw" && typeof window !== "undefined") window.location.href = "/";
    throw new ApiError(401, body?.message ?? "Please sign in again", body?.code);
  }
  if (!res.ok) throw new ApiError(res.status, body?.message ?? res.statusText, body?.code);
  return body as T;
}

const toUser = (u: BackendUser): User => ({
  id: String(u.id),
  name: u.name || u.email,
  email: u.email,
  avatarUrl: u.image,
});

// ---------- Shared plan catalog (fallback when the backend has no billing endpoints) ----------
const DEFAULT_PLANS: Plan[] = [
  { key: "free", label: "For trying it out", name: "Free", priceMonthly: 0, description: "Build your first site and explore.", features: ["30 credits / month", "1 website", "Live preview"] },
  { key: "starter", label: "For individuals", name: "Starter", priceMonthly: 19, description: "Enough credits for steady building.", features: ["300 credits / month", "10 websites", "Custom domain", "Export code"], recommended: true },
  { key: "pro", label: "For teams", name: "Pro", priceMonthly: 49, description: "Heavy usage and priority builds.", features: ["1,000 credits / month", "Unlimited websites", "Priority builds", "Email support"] },
];

// ---------- Server WS event -> app event ----------
function mapServerEvent(raw: unknown): BuildEvent[] {
  const e = raw as Record<string, unknown> | null;
  if (!e || typeof e["type"] !== "string") return [];
  switch (e["type"]) {
    case "log":
      return [{ type: "log", line: String(e["message"] ?? "") }];
    case "toolStart":
      return [{ type: "tool", name: String(e["tool"] ?? "tool") }];
    case "toolEnd":
      return [
        e["error"]
          ? { type: "tool", name: String(e["tool"] ?? "tool"), detail: `Failed: ${String(e["error"])}` }
          : { type: "tool", name: String(e["tool"] ?? "tool"), detail: e["result"] ? String(e["result"]) : "Done" },
      ];
    case "final":
      // Final answer -> assistant message, then mark done and refresh the preview.
      return [
        { type: "message", role: "assistant", content: String(e["response"] ?? "") },
        { type: "refresh" },
        { type: "done" },
      ];
    case "usage":
      return [{ type: "usage", creditsUsed: Number(e["creditsUsed"] ?? 0), balance: Number(e["balance"] ?? 0) }];
    case "error":
      return [{
        type: "error",
        message: String(e["message"] ?? "The build failed."),
        code: typeof e["code"] === "string" ? e["code"] : undefined,
        balance: typeof e["balance"] === "number" ? e["balance"] : undefined,
      }];
    default:
      return [];
  }
}

// Live sockets per website so prompts can be pushed without re-connecting.
const sockets = new Map<string, WebSocket>();

// ---------- Real client ----------
const real = {
  signInWithGoogle: (idToken: string) =>
    request<{ token: string; user: BackendUser }>(
      "/auth/google/",
      { method: "POST", body: JSON.stringify({ token: idToken }) },
      { on401: "throw" },
    ).then((r) => ({ token: r.token, user: toUser(r.user) })),
  me: () => {
    const s = sessionStore.get();
    return s ? Promise.resolve(s.user) : Promise.reject(new ApiError(401, "Not signed in"));
  },
  signOut: async () => sessionStore.clear(),
  listWebsites: async (): Promise<Website[]> => {
    const d = await request<unknown>("/website");
    const arr = Array.isArray(d) ? d : ((d as { websites?: unknown[] } | null)?.["websites"] ?? []);
    return (arr as Record<string, unknown>[]).map(
      (w): Website => ({
        id: String(w["id"] ?? w["websiteId"] ?? ""),
        title: String(w["title"] ?? "Website"),
        template: String(w["template"] ?? "Custom"),
        createdAt: String(w["createdAt"] ?? ""),
        previewUrl: (w["projectUrl"] ?? w["previewUrl"]) as string | undefined,
      }),
    );
  },
  getWebsite: async (id: string): Promise<WebsiteDetail> => {
    const d = await request<Record<string, unknown>>(`/website/${id}`);
    const backendProject = d?.["project"] as Record<string, unknown> | undefined;
    const w = (d?.["website"] as Record<string, unknown> | undefined) ?? backendProject ?? d ?? {};
    const toWebsite = (): Website => ({
      id: String(w["id"] ?? w["websiteId"] ?? id),
      title: String(w["title"] ?? "Website"),
      template: String(w["template"] ?? "Custom"),
      createdAt: String(w["createdAt"] ?? ""),
      previewUrl: (d?.["url"] ?? w["projectUrl"] ?? w["previewUrl"]) as string | undefined,
    });
    const rawMessages = Array.isArray(d?.["messages"])
      ? d["messages"]
      : Array.isArray(backendProject?.["Messages"])
        ? backendProject["Messages"]
        : [];
    const messages = (rawMessages as Record<string, unknown>[]).flatMap((message) => {
      const text = typeof message["text"] === "string" ? message["text"] : "";
      if (!text) return [];
      return [{
        role: message["role"] === "user" ? "user" as const : "assistant" as const,
        content: text,
      }];
    });
    return {
      website: toWebsite(),
      messages,
    };
  },
  createWebsite: (prompt: string) =>
    request<{ websiteId: string; projectUrl?: string }>("/website", {
      method: "POST",
      body: JSON.stringify({ prompt }),
    }),
  deleteWebsite: (websiteId: string) =>
    request<unknown>(`/website/${encodeURIComponent(websiteId)}`, {
      method: "DELETE",
    }),
  sendPrompt: (websiteId: string, prompt: string) => {
    const ws = sockets.get(websiteId);
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify({ type: "chat", prompt }));
    return true;
  },
  plans: async () => {
    try {
      const response = await request<{ plans: BackendBillingPlan[] }>("/billing/plans");
      return response.plans.map((plan, index) => ({
        key: plan.key,
        label: index === 0 ? "For trying it out" : "For individuals and teams",
        name: plan.name,
        priceMonthly: plan.priceMinor / 100,
        description: `${plan.monthlyCredits.toLocaleString()} credits every ${plan.interval}.`,
        features: [
          `${plan.monthlyCredits.toLocaleString()} credits / ${plan.interval}`,
          "Live preview",
          "AI website building",
        ],
        recommended: plan.key.toLowerCase() === "pro",
      }));
    } catch {
      return DEFAULT_PLANS;
    }
  },
  billingMe: async () => {
    try {
      const response = await request<{
        balance: number;
        plan: { key: string } | null;
        latestOrder?: { id: string; status: OrderStatus } | null;
      }>("/billing/me");
      return {
        balance: response.balance,
        planKey: response.plan?.key ?? "free",
        latestOrder: response.latestOrder ?? undefined,
      };
    } catch {
      // Billing endpoints aren't part of the contract; show the last balance the socket reported.
      return { planKey: "free", balance: cachedBalance() };
    }
  },
  checkout: (body: CheckoutBody) =>
    request<{ checkoutUrl: string }>("/billing/checkout", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  openBuildStream(
    websiteId: string,
    onEvent: (e: BuildEvent) => void,
    onConn: (c: ConnState) => void,
    initialPrompt?: string,
  ) {
    let ws: WebSocket | null = null;
    let closed = false;
    let attempt = 0;
    let initialPromptSent = false;
    let timer: ReturnType<typeof setTimeout>;
    const connect = () => {
      const token = sessionStore.token();
      if (!token) {
        onConn("failed");
        return;
      }
      onConn(attempt ? "reconnecting" : "connecting");
      try {
        ws = new WebSocket(`${WS_URL}/?websiteId=${encodeURIComponent(websiteId)}&token=${encodeURIComponent(token)}`);
      } catch {
        return onConn("failed");
      }
      ws.onopen = () => {
        attempt = 0;
        sockets.set(websiteId, ws as WebSocket);
        onConn("open");
        if (initialPrompt?.trim() && !initialPromptSent) {
          initialPromptSent = true;
          ws?.send(JSON.stringify({ type: "chat", prompt: initialPrompt.trim() }));
        }
      };
      ws.onmessage = (m) => {
        try {
          for (const e of mapServerEvent(JSON.parse(String(m.data)))) onEvent(e);
        } catch {
          /* ignore malformed frame */
        }
      };
      ws.onclose = (ev) => {
        sockets.delete(websiteId);
        if (closed) return;
        if (ev.code === 1008) {
          // Auth/ownership rejected — retrying with the same token won't help.
          onConn("failed");
          return;
        }
        attempt++;
        if (attempt > 6) return onConn("failed");
        onConn("reconnecting");
        timer = setTimeout(connect, Math.min(1000 * 2 ** attempt, 10000));
      };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(timer);
      sockets.delete(websiteId);
      ws?.close();
    };
  },
};
export type ConnState = "connecting" | "open" | "reconnecting" | "failed";

// ---------- Demo mock ----------
const DEMO_KEY = "sw_demo_db";
type DemoDb = {
  balance: number;
  planKey: string;
  sites: (Website & { messages: ChatMessage[] })[];
  order?: { id: string; status: OrderStatus; credits: number; planKey?: string | undefined; polls: number };
};
const loadDb = (): DemoDb =>
  JSON.parse(localStorage.getItem(DEMO_KEY) ?? "null") ?? { balance: 30, planKey: "free", sites: [] };
const saveDb = (db: DemoDb) => localStorage.setItem(DEMO_KEY, JSON.stringify(db));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const BUILD_COST = 12;
const DEMO_USER: User = { id: "demo", name: "Demo User", email: "demo@example.com" };

const listeners = new Map<string, Set<(e: BuildEvent) => void>>();
const buffered = new Map<string, BuildEvent[]>();
function emit(id: string, e: BuildEvent) {
  const set = listeners.get(id);
  if (set?.size) set.forEach((fn) => fn(e));
  else buffered.set(id, [...(buffered.get(id) ?? []), e]);
}

function previewHtml(title: string) {
  return (
    "data:text/html;charset=utf-8," +
    encodeURIComponent(
      `<html><body style="margin:0;font-family:system-ui;background:#fafaf7;color:#111">
      <header style="padding:20px 40px;display:flex;justify-content:space-between;border-bottom:1px solid #e5e5e0"><b>${title}</b><span>About · Work · Contact</span></header>
      <section style="padding:96px 40px"><h1 style="font-size:56px;letter-spacing:-.03em;margin:0 0 16px">${title}</h1>
      <p style="font-size:18px;color:#555;max-width:520px">A demo site generated from your prompt. Connect the real backend to see live builds.</p></section></body></html>`,
    )
  );
}

async function demoBuild(id: string, prompt: string) {
  const db = loadDb();
  const site = db.sites.find((s) => s.id === id)!;
  const steps: BuildEvent[] = [
    { type: "status", status: "building" },
    { type: "tool", name: "plan_site", detail: `Outline sections for "${prompt.slice(0, 40)}"` },
    { type: "log", line: "Creating layout and theme…" },
    { type: "tool", name: "write_file", detail: "src/pages/index.tsx" },
    { type: "log", line: "Compiling preview…" },
  ];
  for (const s of steps) {
    await wait(500);
    emit(id, s);
  }
  const reply = `Done. I built a first version of ${site.title} with a header, hero and contact section. Tell me what to change next.`;
  emit(id, { type: "message", role: "assistant", content: "" });
  for (const word of reply.split(" ")) {
    await wait(40);
    emit(id, { type: "token", delta: word + " " });
  }
  const url = previewHtml(site.title);
  const fresh = loadDb();
  fresh.balance = Math.max(0, fresh.balance - BUILD_COST);
  const fs = fresh.sites.find((s) => s.id === id)!;
  fs.previewUrl = url;
  fs.messages.push({ role: "assistant", content: reply });
  saveDb(fresh);
  emit(id, { type: "preview", url });
  emit(id, { type: "usage", creditsUsed: BUILD_COST, balance: fresh.balance });
  emit(id, { type: "refresh" });
  emit(id, { type: "status", status: "ready" });
  emit(id, { type: "done" });
}

const demo: typeof real = {
  signInWithGoogle: async () => ({ token: "demo", user: DEMO_USER }),
  me: async () => DEMO_USER,
  signOut: async () => sessionStore.clear(),
  listWebsites: async () => {
    await wait(250);
    return loadDb().sites.map(({ messages: _m, ...w }) => w);
  },
  getWebsite: async (id) => {
    await wait(150);
    const s = loadDb().sites.find((x) => x.id === id);
    if (!s) throw new ApiError(404, "Website not found");
    const { messages, ...website } = s;
    return { website, messages };
  },
  createWebsite: async (prompt) => {
    await wait(300);
    const db = loadDb();
    const title = prompt.split(/\s+/).slice(0, 4).join(" ").replace(/[^\w\s-]/g, "") || "New site";
    const site = { id: Math.random().toString(36).slice(2, 10), title, template: "Landing page", createdAt: new Date().toISOString(), messages: [] };
    db.sites.unshift(site);
    saveDb(db);
    return { websiteId: site.id };
  },
  sendPrompt: (websiteId, prompt) => {
    const db = loadDb();
    const site = db.sites.find((s) => s.id === websiteId);
    if (!site) return;
    site.messages.push({ role: "user", content: prompt });
    saveDb(db);
    if (loadDb().balance < BUILD_COST) {
      emit(websiteId, {
        type: "error",
        message: "You do not have enough credits.",
        code: "INSUFFICIENT_CREDITS",
        balance: loadDb().balance,
      });
      return;
    }
    void demoBuild(websiteId, prompt);
  },
  plans: async () => {
    await wait(200);
    return DEFAULT_PLANS;
  },
  billingMe: async () => {
    const db = loadDb();
    if (db.order?.status === "pending" && ++db.order.polls >= 2) {
      db.order.status = "paid";
      db.balance += db.order.credits;
      if (db.order.planKey) db.planKey = db.order.planKey;
    }
    saveDb(db);
    return { planKey: db.planKey, balance: db.balance, latestOrder: db.order && { id: db.order.id, status: db.order.status } };
  },  
  checkout: async (body) => {
    await wait(300);
    const db = loadDb();
    const credits = "topupCredits" in body ? body.topupCredits : body.planKey === "pro" ? 1000 : 300;
    db.order = { id: "ord_" + Date.now(), status: "pending", credits, planKey: "planKey" in body ? body.planKey : undefined, polls: 0 };
    saveDb(db);
    return { checkoutUrl: `${window.location.origin}/billing/return` };
  },
  openBuildStream(id, onEvent, onConn) {
    const set = listeners.get(id) ?? new Set();
    set.add(onEvent);
    listeners.set(id, set);
    onConn("open");
    const pending = buffered.get(id) ?? [];
    buffered.delete(id);
    pending.forEach(onEvent);
    return () => set.delete(onEvent);
  },
};

export const api = DEMO ? demo : real;
