import { db, default as dbClient } from "../prisma/db";
import { SIGNUP_BONUS_CREDITS } from "./creditsConfig";

export type CreditTxnType = "grant" | "usage" | "refund" | "adjust";
export type CreditReason =
    | "signup_bonus"
    | "subscription"
    | "topup"
    | "usage"
    | "refund"
    | "adjust";

type TxOrm = typeof db.orm.public;

function nowIso(): string {
    return new Date().toISOString();
}

async function getOrCreateWallet(orm: TxOrm, userId: string) {
    const existing = await orm.CreditWallet.where({ userId }).first();
    if (existing) return existing;
    return orm.CreditWallet.create({
        userId,
        balance: 0,
    });
}

async function appendLedger(
    orm: TxOrm,
    params: {
        userId: string;
        type: CreditTxnType;
        amount: number;
        balanceAfter: number;
        reason: CreditReason | string;
        idempotencyKey: string;
        usageEventId?: string | null;
        orderId?: string | null;
    },
) {
    return orm.CreditTransaction.create({
        userId: params.userId,
        type: params.type,
        amount: params.amount,
        balanceAfter: params.balanceAfter,
        reason: params.reason,
        idempotencyKey: params.idempotencyKey,
        usageEventId: params.usageEventId ?? null,
        orderId: params.orderId ?? null,
    });
}

async function casUpdateBalance(
    orm: TxOrm,
    userId: string,
    expectedBalance: number,
    nextBalance: number,
) {
    const updated = await orm.CreditWallet
        .where({ userId })
        .where((w) => w.balance.eq(expectedBalance))
        .update({
            balance: nextBalance,
            updatedAt: nowIso(),
        });
    return updated !== null;
}

export const CreditService = {
    async getBalance(userId: string): Promise<number> {
        const wallet = await dbClient.CreditWallet.where({ userId }).first();
        return wallet?.balance ?? 0;
    },

    async grant(params: {
        userId: string;
        amount: number;
        reason: CreditReason | string;
        idempotencyKey: string;
        orderId?: string | null;
    }): Promise<{ balance: number; replayed: boolean }> {
        if (params.amount <= 0) {
            throw new Error("grant amount must be positive");
        }

        for (let attempt = 0; attempt < 8; attempt++) {
            try {
                return await db.transaction(async (tx) => {
                    const orm = tx.orm.public;
                    const existing = await orm.CreditTransaction
                        .where({ idempotencyKey: params.idempotencyKey })
                        .first();
                    if (existing) {
                        return { balance: existing.balanceAfter, replayed: true };
                    }

                    const wallet = await getOrCreateWallet(orm, params.userId);
                    const nextBalance = wallet.balance + params.amount;
                    const ok = await casUpdateBalance(orm, params.userId, wallet.balance, nextBalance);
                    if (!ok) throw new Error("CAS_RETRY");

                    await appendLedger(orm, {
                        userId: params.userId,
                        type: "grant",
                        amount: params.amount,
                        balanceAfter: nextBalance,
                        reason: params.reason,
                        idempotencyKey: params.idempotencyKey,
                        orderId: params.orderId ?? null,
                    });

                    return { balance: nextBalance, replayed: false };
                });
            } catch (e: any) {
                if (e?.message === "CAS_RETRY") continue;
                // unique violation on idempotencyKey under concurrency
                const existing = await dbClient.CreditTransaction
                    .where({ idempotencyKey: params.idempotencyKey })
                    .first();
                if (existing) {
                    return { balance: existing.balanceAfter, replayed: true };
                }
                throw e;
            }
        }
        throw new Error("grant failed after retries");
    },

    async charge(params: {
        userId: string;
        credits: number;
        idempotencyKey: string;
        usageEventId: string;
        reason?: CreditReason | string;
    }): Promise<{ balance: number; creditsUsed: number; replayed: boolean }> {
        if (params.credits < 0) {
            throw new Error("charge credits must be >= 0");
        }
        if (params.credits === 0) {
            const balance = await this.getBalance(params.userId);
            return { balance, creditsUsed: 0, replayed: false };
        }

        for (let attempt = 0; attempt < 8; attempt++) {
            try {
                return await db.transaction(async (tx) => {
                    const orm = tx.orm.public;
                    const existing = await orm.CreditTransaction
                        .where({ idempotencyKey: params.idempotencyKey })
                        .first();
                    if (existing) {
                        return {
                            balance: existing.balanceAfter,
                            creditsUsed: Math.abs(existing.amount),
                            replayed: true,
                        };
                    }

                    const wallet = await getOrCreateWallet(orm, params.userId);
                    const nextBalance = wallet.balance - params.credits;
                    const ok = await casUpdateBalance(orm, params.userId, wallet.balance, nextBalance);
                    if (!ok) throw new Error("CAS_RETRY");

                    await appendLedger(orm, {
                        userId: params.userId,
                        type: "usage",
                        amount: -params.credits,
                        balanceAfter: nextBalance,
                        reason: params.reason ?? "usage",
                        idempotencyKey: params.idempotencyKey,
                        usageEventId: params.usageEventId,
                    });

                    return {
                        balance: nextBalance,
                        creditsUsed: params.credits,
                        replayed: false,
                    };
                });
            } catch (e: any) {
                if (e?.message === "CAS_RETRY") continue;
                const existing = await dbClient.CreditTransaction
                    .where({ idempotencyKey: params.idempotencyKey })
                    .first();
                if (existing) {
                    return {
                        balance: existing.balanceAfter,
                        creditsUsed: Math.abs(existing.amount),
                        replayed: true,
                    };
                }
                throw e;
            }
        }
        throw new Error("charge failed after retries");
    },

    async chargeUsage(params: {
        userId: string;
        websiteId: string;
        messageId?: string | null;
        model: string;
        inputTokens: number;
        outputTokens: number;
        cachedInputTokens: number;
        creditsCharged: number;
        usageEventId: string;
    }): Promise<{ balance: number; creditsUsed: number; replayed: boolean }> {
        if (params.creditsCharged < 0) {
            throw new Error("usage credits must be >= 0");
        }

        for (let attempt = 0; attempt < 8; attempt++) {
            try {
                return await db.transaction(async (tx) => {
                    const orm = tx.orm.public;
                    const idempotencyKey = `usage:${params.usageEventId}`;
                    const existing = await orm.CreditTransaction
                        .where({ idempotencyKey })
                        .first();
                    if (existing) {
                        return {
                            balance: existing.balanceAfter,
                            creditsUsed: Math.abs(existing.amount),
                            replayed: true,
                        };
                    }

                    await orm.UsageEvent.create({
                        id: params.usageEventId,
                        userId: params.userId,
                        websiteId: params.websiteId,
                        messageId: params.messageId ?? null,
                        model: params.model,
                        inputTokens: params.inputTokens,
                        outputTokens: params.outputTokens,
                        cachedInputTokens: params.cachedInputTokens,
                        creditsCharged: params.creditsCharged,
                    });

                    const wallet = await getOrCreateWallet(orm, params.userId);
                    const nextBalance = wallet.balance - params.creditsCharged;
                    if (!await casUpdateBalance(orm, params.userId, wallet.balance, nextBalance)) {
                        throw new Error("CAS_RETRY");
                    }

                    await appendLedger(orm, {
                        userId: params.userId,
                        type: "usage",
                        amount: -params.creditsCharged,
                        balanceAfter: nextBalance,
                        reason: "usage",
                        idempotencyKey,
                        usageEventId: params.usageEventId,
                    });

                    return {
                        balance: nextBalance,
                        creditsUsed: params.creditsCharged,
                        replayed: false,
                    };
                });
            } catch (e: any) {
                if (e?.message === "CAS_RETRY") continue;
                const existing = await dbClient.CreditTransaction
                    .where({ idempotencyKey: `usage:${params.usageEventId}` })
                    .first();
                if (existing) {
                    return {
                        balance: existing.balanceAfter,
                        creditsUsed: Math.abs(existing.amount),
                        replayed: true,
                    };
                }
                throw e;
            }
        }
        throw new Error("usage charge failed after retries");
    },

    async refund(params: {
        userId: string;
        amount: number;
        idempotencyKey: string;
        reason?: CreditReason | string;
        usageEventId?: string | null;
        orderId?: string | null;
    }): Promise<{ balance: number; replayed: boolean }> {
        if (params.amount <= 0) {
            throw new Error("refund amount must be positive");
        }

        for (let attempt = 0; attempt < 8; attempt++) {
            try {
                return await db.transaction(async (tx) => {
                    const orm = tx.orm.public;
                    const existing = await orm.CreditTransaction
                        .where({ idempotencyKey: params.idempotencyKey })
                        .first();
                    if (existing) {
                        return { balance: existing.balanceAfter, replayed: true };
                    }

                    const wallet = await getOrCreateWallet(orm, params.userId);
                    const nextBalance = wallet.balance + params.amount;
                    const ok = await casUpdateBalance(orm, params.userId, wallet.balance, nextBalance);
                    if (!ok) throw new Error("CAS_RETRY");

                    await appendLedger(orm, {
                        userId: params.userId,
                        type: "refund",
                        amount: params.amount,
                        balanceAfter: nextBalance,
                        reason: params.reason ?? "refund",
                        idempotencyKey: params.idempotencyKey,
                        usageEventId: params.usageEventId ?? null,
                        orderId: params.orderId ?? null,
                    });

                    return { balance: nextBalance, replayed: false };
                });
            } catch (e: any) {
                if (e?.message === "CAS_RETRY") continue;
                const existing = await dbClient.CreditTransaction
                    .where({ idempotencyKey: params.idempotencyKey })
                    .first();
                if (existing) {
                    return { balance: existing.balanceAfter, replayed: true };
                }
                throw e;
            }
        }
        throw new Error("refund failed after retries");
    },

    /** Create user + wallet + signup bonus in one transaction */
    async createUserWithSignupBonus(params: {
        email: string;
        name: string;
        googleId: string;
    }) {
        return db.transaction(async (tx) => {
            const orm = tx.orm.public;
            const user = await orm.User.create({
                email: params.email,
                name: params.name,
                googleId: params.googleId,
            });

            await orm.CreditWallet.create({
                userId: user.id,
                balance: SIGNUP_BONUS_CREDITS,
            });

            await orm.CreditTransaction.create({
                userId: user.id,
                type: "grant",
                amount: SIGNUP_BONUS_CREDITS,
                balanceAfter: SIGNUP_BONUS_CREDITS,
                reason: "signup_bonus",
                idempotencyKey: `signup_bonus:${user.id}`,
            });

            return user;
        });
    },
};
