import crypto from "crypto";

// Bachs is a payments & billing platform. See https://docs.bachs.io.
// - Money is always a decimal string at the currency's precision (e.g. "285.00")
//   paired with an ISO 4217 currency code. Never use minor units.
// - Build against the sandbox first (https://sandbox-api.bachs.io with
//   sk_sandbox_ keys); production is https://api.bachs.io with sk_live_ keys.
// - Treat webhooks (e.g. collection.succeeded) as the source of truth for
//   fulfilment, never client-side redirects.

const SANDBOX_BASE = "https://sandbox-api.bachs.io";
const PROD_BASE = "https://api.bachs.io";

export function getBachsKey(): string {
  const key = process.env.BACHS_API_KEY;
  if (!key) throw new Error("BACHS_API_KEY is not configured");
  return key;
}

export function getBachsBaseUrl(): string {
  const key = getBachsKey();
  return key.startsWith("sk_sandbox_") ? SANDBOX_BASE : PROD_BASE;
}

export function getBachsWebhookSecret(): string {
  const secret = process.env.BACHS_WEBHOOK_SECRET;
  if (!secret) throw new Error("BACHS_WEBHOOK_SECRET is not configured");
  return secret;
}

// Formats a price already in major units (e.g. 28500 for NGN 28,500.00) as the
// decimal string Bachs expects. Bachs quotes money as a decimal string at the
// currency's precision and never uses minor units.
export function toDecimalString(amountMajor: number, currency: string): string {
  const decimals = currency === "JPY" ? 0 : 2;
  return amountMajor.toFixed(decimals);
}

export interface BachsCheckoutParams {
  customerEmail: string;
  customerName?: string | null;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
  reference?: string;
  // One of these two must be provided (mutually exclusive).
  pricing?: { currency: string; amount: string };
  productCart?: { product_id: string; quantity?: number }[];
  paymentMethodOptions?: Record<string, Record<string, unknown>>;
  expiresInMinutes?: number;
}

export interface BachsCheckoutResult {
  checkout_id: string;
  checkout_url: string;
  status: string;
}

export async function createCheckoutSession(
  params: BachsCheckoutParams
): Promise<BachsCheckoutResult> {
  const key = getBachsKey();
  const base = getBachsBaseUrl();

  const hasPricing = !!params.pricing;
  const hasCart = !!params.productCart && params.productCart.length > 0;
  if (hasPricing === hasCart) {
    throw new Error("Provide exactly one of pricing or productCart");
  }

  const body: Record<string, unknown> = {
    customer: {
      email: params.customerEmail,
      ...(params.customerName ? { name: params.customerName } : {}),
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    ...(params.metadata ? { metadata: params.metadata } : {}),
    ...(params.reference ? { reference: params.reference } : {}),
    ...(params.expiresInMinutes ? { expires_in_minutes: params.expiresInMinutes } : {}),
    ...(params.paymentMethodOptions ? { payment_method_options: params.paymentMethodOptions } : {}),
  };

  if (params.pricing) {
    body.pricing = {
      currency: params.pricing.currency,
      amount: params.pricing.amount,
    };
  } else if (params.productCart) {
    body.product_cart = params.productCart.map((p) => ({
      product_id: p.product_id,
      ...(p.quantity && p.quantity !== 1 ? { quantity: p.quantity } : {}),
    }));
  }

  const res = await fetch(`${base}/v1/checkout-sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bachs checkout failed (${res.status}): ${text}`);
  }

  return (await res.json()) as BachsCheckoutResult;
}

export interface BachsWebhookEnvelope {
  id: string;
  type: string;
  created_at?: string;
  organization_id?: string;
  data: Record<string, unknown>;
}

// Verifies a Bachs webhook signature. Every delivery includes:
//   X-Bachs-Timestamp: unix seconds
//   X-Bachs-Signature: HMAC-SHA256 hex of `"{timestamp}.{rawBody}"`
// Always pass the RAW (unparsed) request body and validate the timestamp within
// a tolerance to reject stale replay attempts.
export function verifyBachsSignature(
  rawBody: string | Buffer,
  timestampHeader: string | null,
  signatureHeader: string | null,
  toleranceSeconds = 300
): boolean {
  if (!timestampHeader || !signatureHeader) return false;

  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleranceSeconds) return false;

  const raw = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
  const message = `${timestamp}.${raw}`;
  const secret = getBachsWebhookSecret();
  const expected = crypto.createHmac("sha256", secret).update(message, "utf8").digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signatureHeader, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
