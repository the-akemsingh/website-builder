import dbClient, { db } from "../prisma/db";
import { getPaymentProvider } from "./providers";
import type { WebhookRequest } from "./providers/types";

function nowIso(): string {
    return new Date().toISOString();
}

function addDaysIso(days: number): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString();
}

export async function processProviderWebhook(
    providerName: string,
    req: WebhookRequest,
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
    const provider = getPaymentProvider();
    if (provider.name !== providerName) {
        return { ok: false, status: 404, body: { error: "Unknown provider" } };
    }

    const valid = await provider.verifyWebhook(req);
    if (!valid) {
        return { ok: false, status: 401, body: { error: "Invalid signature" } };
    }

    const event = provider.parseEvent(req.body);
    if (!event.orderId || event.type === "unknown") {
        return { ok: false, status: 400, body: { error: "Unrecognized event" } };
    }

    const existing = await dbClient.WebhookEvent
        .where({ providerEventId: event.providerEventId })
        .first();
    if (existing?.processedAt) {
        return { ok: true, status: 200, body: { deduped: true } };
    }

    try {
        await db.transaction(async (tx) => {
            const orm = tx.orm.public;

            if (!existing) {
                await orm.WebhookEvent.create({
                    provider: providerName,
                    providerEventId: event.providerEventId,
                    payload: event.raw as any,
                });
            }

            const order = await orm.Order.where({ id: event.orderId }).first();
            if (!order) {
                throw new Error("ORDER_NOT_FOUND");
            }

            if (event.type === "order.failed") {
                if (order.status !== "paid") {
                    await orm.Order.where({ id: order.id }).update({
                        status: "failed",
                        updatedAt: nowIso(),
                    });
                }
                await orm.WebhookEvent
                    .where({ providerEventId: event.providerEventId })
                    .update({ processedAt: nowIso() });
                return;
            }

            // order.paid — idempotent
            if (order.status !== "paid") {
                await orm.Order.where({ id: order.id }).update({
                    status: "paid",
                    providerPaymentId: event.providerPaymentId ?? order.providerPaymentId,
                    updatedAt: nowIso(),
                });
            }

            if (order.kind === "topup") {
                const credits = order.credits ?? 0;
                if (credits > 0) {
                    // grant outside nested CAS loops by inlining ledger here for atomicity with order
                    const wallet =
                        (await orm.CreditWallet.where({ userId: order.userId }).first()) ??
                        (await orm.CreditWallet.create({ userId: order.userId, balance: 0 }));

                    const idempotencyKey = `topup:${order.id}`;
                    const prior = await orm.CreditTransaction
                        .where({ idempotencyKey })
                        .first();
                    if (!prior) {
                        const nextBalance = wallet.balance + credits;
                        await orm.CreditWallet.where({ id: wallet.id }).update({
                            balance: nextBalance,
                            updatedAt: nowIso(),
                        });
                        await orm.CreditTransaction.create({
                            userId: order.userId,
                            type: "grant",
                            amount: credits,
                            balanceAfter: nextBalance,
                            reason: "topup",
                            idempotencyKey,
                            orderId: order.id,
                        });
                    }
                }
            } else if (order.kind === "subscription" && order.planId) {
                const plan = await orm.Plan.where({ id: order.planId }).first();
                if (!plan) throw new Error("PLAN_NOT_FOUND");

                const periodEnd = addDaysIso(plan.interval === "year" ? 365 : 30);
                const existingSub = await orm.Subscription
                    .where({ userId: order.userId })
                    .first();

                if (existingSub) {
                    await orm.Subscription.where({ id: existingSub.id }).update({
                        planId: plan.id,
                        status: "active",
                        currentPeriodEnd: periodEnd,
                        provider: providerName,
                        providerCustomerId:
                            event.providerCustomerId ?? existingSub.providerCustomerId,
                        providerSubscriptionId:
                            event.providerSubscriptionId ?? existingSub.providerSubscriptionId,
                        updatedAt: nowIso(),
                    });
                } else {
                    await orm.Subscription.create({
                        userId: order.userId,
                        planId: plan.id,
                        status: "active",
                        currentPeriodEnd: periodEnd,
                        provider: providerName,
                        providerCustomerId: event.providerCustomerId ?? null,
                        providerSubscriptionId: event.providerSubscriptionId ?? null,
                    });
                }

                const idempotencyKey = `subscription:${order.id}`;
                const prior = await orm.CreditTransaction
                    .where({ idempotencyKey })
                    .first();
                if (!prior) {
                    const wallet =
                        (await orm.CreditWallet.where({ userId: order.userId }).first()) ??
                        (await orm.CreditWallet.create({ userId: order.userId, balance: 0 }));
                    const nextBalance = wallet.balance + plan.monthlyCredits;
                    await orm.CreditWallet.where({ id: wallet.id }).update({
                        balance: nextBalance,
                        updatedAt: nowIso(),
                    });
                    await orm.CreditTransaction.create({
                        userId: order.userId,
                        type: "grant",
                        amount: plan.monthlyCredits,
                        balanceAfter: nextBalance,
                        reason: "subscription",
                        idempotencyKey,
                        orderId: order.id,
                    });
                }
            }

            await orm.WebhookEvent
                .where({ providerEventId: event.providerEventId })
                .update({ processedAt: nowIso() });
        });
    } catch (e: any) {
        if (e?.message === "ORDER_NOT_FOUND") {
            return { ok: false, status: 404, body: { error: "Order not found" } };
        }
        // unique race on webhook insert — treat as dedupe if already processed
        const again = await dbClient.WebhookEvent
            .where({ providerEventId: event.providerEventId })
            .first();
        if (again?.processedAt) {
            return { ok: true, status: 200, body: { deduped: true } };
        }
        console.error("webhook processing failed", e);
        return { ok: false, status: 500, body: { error: "Webhook processing failed" } };
    }

    return { ok: true, status: 200, body: { received: true } };
}
