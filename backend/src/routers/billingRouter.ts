import { Router } from "express";
import crypto from "crypto";
import authentication from "../middleware/auth";
import dbClient from "../prisma/db";
import { CreditService } from "../billing/creditService";
import {
    TOPUP_PRICE_PER_CREDIT_MINOR,
} from "../billing/creditsConfig";
import { getPaymentProvider, signMockWebhook } from "../billing/providers";
import { processProviderWebhook } from "../billing/webhookProcessor";
import { config } from "../config";

const billingRouter = Router();

function nowIso(): string {
    return new Date().toISOString();
}

billingRouter.get("/plans", async (_req, res) => {
    try {
        const plans = await dbClient.Plan
            .where({ isActive: true })
            .select("id", "key", "name", "monthlyCredits", "priceMinor", "currency", "interval")
            .orderBy((p) => p.priceMinor.asc())
            .all();
        res.json({ plans });
    } catch (e) {
        console.error("GET /billing/plans", e);
        res.sendStatus(500);
    }
});

billingRouter.get("/me", authentication, async (req, res) => {
    try {
        const userId = req.userId!;
        const balance = await CreditService.getBalance(userId);
        const subscription = await dbClient.Subscription.where({ userId }).first();
        const plan = subscription
            ? await dbClient.Plan
                .select("key", "name", "monthlyCredits")
                .where({ id: subscription.planId })
                .first()
            : null;
        const latestOrder = await dbClient.Order
            .where({ userId })
            .select("id", "status")
            .orderBy((order) => order.createdAt.desc())
            .first();

        res.json({
            balance,
            plan: plan
                ? {
                    key: plan.key,
                    name: plan.name,
                    monthlyCredits: plan.monthlyCredits,
                    status: subscription!.status,
                    currentPeriodEnd: subscription!.currentPeriodEnd,
                }
                : null,
            latestOrder: latestOrder
                ? { id: latestOrder.id, status: latestOrder.status }
                : null,
        });
    } catch (e) {
        console.error("GET /billing/me", e);
        res.sendStatus(500);
    }
});

billingRouter.post("/checkout", authentication, async (req, res) => {
    try {
        const userId = req.userId!;
        const { planKey, topupCredits, returnUrl } = req.body as {
            planKey?: string;
            topupCredits?: number;
            returnUrl?: string;
        };

        if (!planKey && !topupCredits) {
            res.status(400).json({ error: "Provide planKey or topupCredits" });
            return;
        }
        if (planKey && topupCredits) {
            res.status(400).json({ error: "Provide only one of planKey or topupCredits" });
            return;
        }

        const provider = getPaymentProvider();
        let order;

        if (planKey) {
            const plan = await dbClient.Plan.where({ key: planKey, isActive: true }).first();
            if (!plan) {
                res.status(404).json({ error: "Plan not found" });
                return;
            }
            order = await dbClient.Order.create({
                userId,
                kind: "subscription",
                planId: plan.id,
                credits: plan.monthlyCredits,
                amountMinor: plan.priceMinor,
                currency: plan.currency,
                status: "pending",
                provider: provider.name,
            });

            const checkout = await provider.createCheckout({
                orderId: order.id,
                userId,
                kind: "subscription",
                amountMinor: plan.priceMinor,
                currency: plan.currency,
                planKey: plan.key,
                credits: plan.monthlyCredits,
                successUrl: returnUrl,
            });

            await dbClient.Order.where({ id: order.id }).update({
                providerOrderId: checkout.providerOrderId,
                updatedAt: nowIso(),
            });

            res.json({ checkoutUrl: checkout.checkoutUrl });
            return;
        }

        const credits = Number(topupCredits);
        if (!Number.isInteger(credits) || credits <= 0) {
            res.status(400).json({ error: "topupCredits must be a positive integer" });
            return;
        }

        const amountMinor = credits * TOPUP_PRICE_PER_CREDIT_MINOR;
        order = await dbClient.Order.create({
            userId,
            kind: "topup",
            credits,
            amountMinor,
            currency: "USD",
            status: "pending",
            provider: provider.name,
        });

        const checkout = await provider.createCheckout({
            orderId: order.id,
            userId,
            kind: "topup",
            amountMinor,
            currency: "USD",
            credits,
            successUrl: returnUrl,
        });

        await dbClient.Order.where({ id: order.id }).update({
            providerOrderId: checkout.providerOrderId,
            updatedAt: nowIso(),
        });

        res.json({ checkoutUrl: checkout.checkoutUrl });
    } catch (e) {
        console.error("POST /billing/checkout", e);
        res.sendStatus(500);
    }
});

/** Local mock checkout page — fires a signed fake paid webhook */
billingRouter.get("/mock/pay", async (req, res) => {
    try {
        if (config.get("paymentProvider") !== "mock") {
            res.status(404).send("Mock provider disabled");
            return;
        }

        const orderId = String(req.query.orderId ?? "");
        if (!orderId) {
            res.status(400).send("Missing orderId");
            return;
        }

        const order = await dbClient.Order.where({ id: orderId }).first();
        if (!order) {
            res.status(404).send("Order not found");
            return;
        }

        const payload = {
            id: `mock_evt_${crypto.randomUUID()}`,
            type: "order.paid",
            data: {
                orderId: order.id,
                providerPaymentId: `mock_pay_${crypto.randomUUID()}`,
                providerCustomerId: `mock_cus_${order.userId}`,
                providerSubscriptionId:
                    order.kind === "subscription"
                        ? `mock_sub_${crypto.randomUUID()}`
                        : undefined,
            },
        };
        const rawBody = JSON.stringify(payload);
        const signature = signMockWebhook(rawBody);
        const baseUrl = config.get("publicBaseUrl");

        const webhookRes = await fetch(`${baseUrl}/api/v1/webhooks/mock`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-mock-signature": signature,
            },
            body: rawBody,
        });

        const result = await webhookRes.json().catch(() => ({}));
        const returnUrl = typeof req.query.returnUrl === "string" ? req.query.returnUrl : null;
        if (webhookRes.ok && returnUrl) {
            const redirect = new URL(returnUrl);
            redirect.searchParams.set("orderId", order.id);
            res.redirect(303, redirect.toString());
            return;
        }
        res.status(200).send(
            `<html><body><h1>Mock payment ${webhookRes.ok ? "succeeded" : "failed"}</h1>` +
            `<pre>${JSON.stringify(result, null, 2)}</pre>` +
            `<p>You can close this window.</p></body></html>`,
        );
    } catch (e) {
        console.error("GET /billing/mock/pay", e);
        res.status(500).send("Mock payment failed");
    }
});

export default billingRouter;

export async function webhookHandler(req: any, res: any) {
    const provider = String(req.params.provider ?? "");
    const rawBody: Buffer | string =
        req.rawBody ??
        (typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {}));

    const result = await processProviderWebhook(provider, {
        headers: req.headers,
        rawBody,
        body: typeof req.body === "string" ? JSON.parse(req.body) : req.body,
    });
    res.status(result.status).json(result.body);
}
