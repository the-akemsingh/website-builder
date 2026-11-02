import crypto from "crypto";
import { config } from "../../config";
import type {
    CreateCheckoutInput,
    CreateCheckoutResult,
    ParsedPaymentEvent,
    PaymentProvider,
    WebhookRequest,
} from "./types";

const MOCK_SECRET = "mock-webhook-secret";

export function signMockWebhook(body: string): string {
    return crypto.createHmac("sha256", MOCK_SECRET).update(body).digest("hex");
}

export class MockProvider implements PaymentProvider {
    readonly name = "mock";

    async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
        const providerOrderId = `mock_ord_${input.orderId}`;
        const baseUrl = config.get("publicBaseUrl");
        const checkoutUrl =
            `${baseUrl}/api/v1/billing/mock/pay` +
            `?orderId=${encodeURIComponent(input.orderId)}` +
            `&providerOrderId=${encodeURIComponent(providerOrderId)}` +
            (input.successUrl ? `&returnUrl=${encodeURIComponent(input.successUrl)}` : "");
        return { checkoutUrl, providerOrderId };
    }

    verifyWebhook(req: WebhookRequest): boolean {
        const signatureHeader = req.headers["x-mock-signature"];
        const signature = Array.isArray(signatureHeader)
            ? signatureHeader[0]
            : signatureHeader;
        if (!signature) return false;
        const raw =
            typeof req.rawBody === "string"
                ? req.rawBody
                : req.rawBody.toString("utf8");
        const expected = signMockWebhook(raw);
        try {
            return crypto.timingSafeEqual(
                Buffer.from(signature),
                Buffer.from(expected),
            );
        } catch {
            return false;
        }
    }

    parseEvent(payload: unknown): ParsedPaymentEvent {
        const data = payload as {
            id?: string;
            type?: string;
            data?: {
                orderId?: string;
                providerPaymentId?: string;
                providerCustomerId?: string;
                providerSubscriptionId?: string;
            };
        };

        return {
            providerEventId: data.id ?? `mock_evt_${crypto.randomUUID()}`,
            type: data.type === "order.paid"
                ? "order.paid"
                : data.type === "order.failed"
                    ? "order.failed"
                    : "unknown",
            orderId: data.data?.orderId ?? "",
            providerPaymentId: data.data?.providerPaymentId,
            providerCustomerId: data.data?.providerCustomerId,
            providerSubscriptionId: data.data?.providerSubscriptionId,
            raw: payload,
        };
    }
}
