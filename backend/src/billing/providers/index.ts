import { config } from "../../config";
import { MockProvider } from "./mockProvider";
import type { PaymentProvider } from "./types";

export type { PaymentProvider } from "./types";
export { MockProvider, signMockWebhook } from "./mockProvider";

let cached: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
    if (cached) return cached;
    const name = config.get("paymentProvider");
    switch (name) {
        case "mock":
        default:
            cached = new MockProvider();
            return cached;
    }
}
