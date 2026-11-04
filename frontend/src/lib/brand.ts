export const BRAND = "Sitewright";
export const PENDING_PROMPT_KEY = "sw_pending_prompt";

export type PendingPrompt = { prompt: string; websiteId?: string };
export const pendingPrompt = {
  get: (): PendingPrompt | null => {
    if (typeof window === "undefined") return null;
    try {
      return JSON.parse(localStorage.getItem(PENDING_PROMPT_KEY) ?? "null");
    } catch {
      return null;
    }
  },
  set: (p: PendingPrompt) => localStorage.setItem(PENDING_PROMPT_KEY, JSON.stringify(p)),
  clear: () => localStorage.removeItem(PENDING_PROMPT_KEY),
};
