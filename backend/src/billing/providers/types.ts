export type CheckoutKind = "subscription" | "topup";

export type CreateCheckoutInput = {
    orderId: string;
    userId: string;
    kind: CheckoutKind;
    amountMinor: number;
    currency: string;
    planKey?: string;
    credits?: number;
    successUrl?: string;
    cancelUrl?: string;
};

export type CreateCheckoutResult = {
    checkoutUrl: string;
    providerOrderId: string;
};

export type ParsedPaymentEvent = {
    providerEventId: string;
    type: "order.paid" | "order.failed" | "unknown";
    orderId: string;
    providerPaymentId?: string;
    providerCustomerId?: string;
    providerSubscriptionId?: string;
    raw: unknown;
};

export type WebhookRequest = {
    headers: Record<string, string | string[] | undefined>;
    rawBody: Buffer | string;
    body: unknown;
};

export interface PaymentProvider {
    readonly name: string;
    createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
    verifyWebhook(req: WebhookRequest): Promise<boolean> | boolean;
    parseEvent(payload: unknown): ParsedPaymentEvent;
}
