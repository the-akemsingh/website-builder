export const COST_PER_CREDIT = 0.001; // USD per credit

/** USD per 1M tokens */
export type ModelRate = {
    inputPerMTok: number;
    cachedInputPerMTok: number;
    outputPerMTok: number;
};

export const MODEL_RATES: Record<string, ModelRate> = {
    "gemini-3.1-flash-lite": {
        inputPerMTok: 0.10,
        cachedInputPerMTok: 0.025,
        outputPerMTok: 0.40,
    },
    "gemini-2.5-flash": {
        inputPerMTok: 0.15,
        cachedInputPerMTok: 0.0375,
        outputPerMTok: 0.60,
    },
};

export const DEFAULT_MODEL = "gemini-3.1-flash-lite";

export const SIGNUP_BONUS_CREDITS = 500;

/** Minor units (cents) charged per credit for ad-hoc top-ups */
export const TOPUP_PRICE_PER_CREDIT_MINOR = 1;

export const MAX_AGENT_ITERATIONS = 30;
export const MAX_OUTPUT_TOKENS_PER_RUN = 200_000;

export function creditsForTokens(
    model: string,
    inputTokens: number,
    outputTokens: number,
    cachedInputTokens: number,
): number {
    const rate = MODEL_RATES[model] ?? MODEL_RATES[DEFAULT_MODEL]!;
    const cost =
        (Math.max(0, inputTokens - cachedInputTokens) / 1_000_000) * rate.inputPerMTok +
        (cachedInputTokens / 1_000_000) * rate.cachedInputPerMTok +
        (outputTokens / 1_000_000) * rate.outputPerMTok;
    return Math.max(0, Math.ceil(cost / COST_PER_CREDIT));
}
