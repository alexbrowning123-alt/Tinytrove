import Stripe from "stripe";

// Lazily-initialized Stripe client. Only created once STRIPE_SECRET_KEY is set.
let client: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  if (!client) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("Stripe is not configured (STRIPE_SECRET_KEY missing).");
    }
    client = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return client;
}

export function publicAppUrl(): string {
  return (process.env.PUBLIC_APP_URL || "http://localhost:5000").replace(/\/$/, "");
}

// Platform fee in basis points (e.g. 500 = 5%). Defaults to 0 in test mode.
export function platformFeeBps(): number {
  const n = Number(process.env.PLATFORM_FEE_BPS ?? 0);
  return Number.isFinite(n) && n >= 0 && n <= 10000 ? n : 0;
}

export function computeFeePence(amountPence: number, bps: number): number {
  // Integer-safe: fee = floor(amount * bps / 10000). Stripe rejects fractional fees.
  return Math.floor((amountPence * bps) / 10000);
}

export function toPence(price: number): number {
  return Math.round(price * 100);
}

export interface StripeAccountStatus {
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  onboardingComplete: boolean;
}

export async function createConnectAccount(
  user: { id: number; email: string }
): Promise<{ id: string; status: StripeAccountStatus }> {
  const stripe = getStripe();
  const account = await stripe.accounts.create({
    type: "express",
    country: "GB",
    email: user.email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: { userId: String(user.id) },
  });
  return { id: account.id, status: toAccountStatus(account) };
}

export async function createOnboardingLink(
  accountId: string
): Promise<{ url: string; expiresAt: number }> {
  const stripe = getStripe();
  const base = publicAppUrl();
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${base}/profile?stripe=refresh`,
    return_url: `${base}/profile?stripe=return`,
    type: "account_onboarding",
  });
  return { url: link.url, expiresAt: link.expires_at };
}

export async function getAccountStatus(
  accountId: string
): Promise<StripeAccountStatus> {
  const stripe = getStripe();
  const account = await stripe.accounts.retrieve(accountId);
  return toAccountStatus(account);
}

function toAccountStatus(account: Stripe.Account): StripeAccountStatus {
  return {
    chargesEnabled: !!account.charges_enabled,
    payoutsEnabled: !!account.payouts_enabled,
    detailsSubmitted: !!account.details_submitted,
    onboardingComplete:
      !!account.details_submitted &&
      !!account.charges_enabled &&
      !!account.payouts_enabled,
  };
}

export interface CheckoutSessionInput {
  amountPence: number;
  applicationFeePence: number;
  listingId: number;
  offerId?: number | null;
  buyerId: number;
  sellerId: number;
  sellerStripeAccountId: string;
  listingTitle: string;
  buyerEmail?: string | null;
}

export async function createCheckoutSession(
  input: CheckoutSessionInput
): Promise<{ id: string; url: string }> {
  const stripe = getStripe();
  const base = publicAppUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: input.buyerEmail || undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: input.amountPence,
          product_data: { name: input.listingTitle },
        },
      },
    ],
    shipping_address_collection: { allowed_countries: ["GB"] },
    phone_number_collection: { enabled: true },
    success_url: `${base}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/checkout/${input.listingId}?cancelled=1`,
    payment_intent_data: {
      application_fee_amount: input.applicationFeePence,
      transfer_data: { destination: input.sellerStripeAccountId },
    },
    metadata: {
      listingId: String(input.listingId),
      offerId: input.offerId ? String(input.offerId) : "",
      buyerId: String(input.buyerId),
      sellerId: String(input.sellerId),
      amountPence: String(input.amountPence),
      applicationFeePence: String(input.applicationFeePence),
    },
  });
  return { id: session.id, url: session.url! };
}
