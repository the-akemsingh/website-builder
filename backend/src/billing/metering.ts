import crypto from "crypto";
import { CreditService } from "./creditService";
import { creditsForTokens } from "./creditsConfig";

export type MeteringContext = {
    userId: string;
    websiteId: string;
    messageId?: string | null;
    onUsage?: (event: { type: "usage"; creditsUsed: number; balance: number }) => void;
};

export type ProviderUsage = {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
};

export function extractProviderUsage(response: any): ProviderUsage {
    const meta = response?.usageMetadata ?? {};
    return {
        inputTokens: Number(meta.promptTokenCount ?? 0) || 0,
        outputTokens: Number(meta.candidatesTokenCount ?? meta.responseTokenCount ?? 0) || 0,
        cachedInputTokens: Number(meta.cachedContentTokenCount ?? 0) || 0,
    };
}

export async function recordAndChargeLlmCall(
    ctx: MeteringContext,
    model: string,
    usage: ProviderUsage,
): Promise<{ creditsUsed: number; balance: number }> {
    const creditsCharged = creditsForTokens(
        model,
        usage.inputTokens,
        usage.outputTokens,
        usage.cachedInputTokens,
    );

    const { balance, creditsUsed } = await CreditService.chargeUsage({
        userId: ctx.userId,
        websiteId: ctx.websiteId,
        messageId: ctx.messageId,
        model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cachedInputTokens: usage.cachedInputTokens,
        creditsCharged,
        usageEventId: crypto.randomUUID(),
    });

    ctx.onUsage?.({ type: "usage", creditsUsed, balance });
    return { creditsUsed, balance };
}
