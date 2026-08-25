import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { ShieldCheck, ArrowLeft, Loader2 } from "lucide-react";
import {
  useCart,
  useCheckout,
  useBuyNow,
  useListing,
  useAcceptedOffer,
  useMe,
  useStripeConfig,
  useCreateCheckoutSession,
} from "@/lib/hooks";
import type { DeliveryDetails } from "@/lib/hooks";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice, mediaUrl } from "@/components/common";

const emptyDelivery: DeliveryDetails = {
  deliveryName: "",
  deliveryAddress1: "",
  deliveryAddress2: "",
  deliveryCity: "",
  deliveryPostcode: "",
  contactEmail: "",
};

function readListingIdFromParams(params: { listingId?: string }): number | null {
  const v = params.listingId;
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

export default function Checkout() {
  const params = useParams<{ listingId?: string }>();
  const [, navigate] = useLocation();
  const me = useMe();
  const [form, setForm] = useState<DeliveryDetails>(emptyDelivery);
  const [error, setError] = useState<string | null>(null);

  const buyNowId = readListingIdFromParams(params);
  const cart = useCart();
  const singleListing = useListing(buyNowId);
  const acceptedOffer = useAcceptedOffer(buyNowId);

  const checkout = useCheckout();
  const buyNow = useBuyNow();
  const pending = checkout.isPending || buyNow.isPending;

  const stripeConfig = useStripeConfig();
  const createSession = useCreateCheckoutSession();
  const stripeEnabled = !!stripeConfig.data?.enabled && buyNowId != null;

  if (!me.isLoading && !me.data) {
    setTimeout(() => {
      if (window.location.hash !== "#/login") window.location.hash = "#/login";
    }, 0);
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center text-sm text-muted-foreground">
        Log in to check out.
      </div>
    );
  }

  // Build the order summary from either the cart or the single buy-now listing.
  let summaryItems: Array<{ id: number; title: string; price: number; image?: string | null; brand?: string }> = [];
  let total = 0;
  let ready = false;

  if (buyNowId != null) {
    if (singleListing.isLoading) ready = false;
    else if (singleListing.data) {
      const l = singleListing.data;
      const imgs: string[] = (l as any).imageList ?? [];
      const offerPrice = acceptedOffer.data?.price ?? null;
      const price = offerPrice ?? l.price;
      summaryItems = [{ id: l.id, title: l.title, price, image: imgs[0], brand: l.brand }];
      total = price;
      ready = !singleListing.isLoading && !acceptedOffer.isFetching;
    }
  } else {
    const items = cart.data ?? [];
    summaryItems = items
      .filter((c) => c.listing)
      .map((c) => {
        const l = c.listing!;
        const imgs: string[] = (l as any).imageList ?? [];
        return { id: l.id, title: l.title, price: l.price, image: imgs[0], brand: l.brand };
      });
    total = summaryItems.reduce((s, i) => s + i.price, 0);
    ready = !cart.isLoading;
  }

  const set = (k: keyof DeliveryDetails, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Stripe path: redirect the buyer to Stripe's hosted checkout.
  const handleStripePay = async () => {
    setError(null);
    try {
      const res = await createSession.mutateAsync(buyNowId!);
      if (res?.url) window.location.href = res.url;
    } catch (err) {
      const msg = (err as Error).message || "";
      const detail = msg.includes(":") ? msg.split(":").slice(1).join(":").trim() : msg;
      setError(detail || "Couldn't start payment. Please try again.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const delivery: DeliveryDetails = { ...form, contactEmail: form.contactEmail.trim().toLowerCase() };
    try {
      if (buyNowId != null) {
        const order = await buyNow.mutateAsync({ listingId: buyNowId, delivery });
        navigate(`/order/${order.id}`);
      } else {
        const order = await checkout.mutateAsync(delivery);
        navigate(`/order/${order.id}`);
      }
    } catch (err) {
      const msg = (err as Error).message || "";
      const detail = msg.includes(":") ? msg.split(":").slice(1).join(":").trim() : msg;
      setError(detail || "Couldn't place your order. Please try again.");
    }
  };

  if (ready && summaryItems.length === 0 && buyNowId == null) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="font-serif text-lg font-600">Your basket is empty</p>
        <p className="mt-1 text-sm text-muted-foreground">Add an item before checking out.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-5 md:pb-12">
      <button
        onClick={() => navigate(buyNowId != null ? `/listing/${buyNowId}` : "/cart")}
        className="mb-3 inline-flex items-center gap-1 text-sm font-500 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} /> {buyNowId != null ? "Back to item" : "Back to basket"}
      </button>

      <h1 className="font-serif text-xl font-700">Checkout</h1>

      <div className="mt-5 grid gap-6 md:grid-cols-[1fr_minmax(0,340px)]">
        {/* Left: payment form / Stripe pay card */}
        {stripeEnabled ? (
          <div className="space-y-4 rounded-xl border border-border/70 bg-card p-4">
            <div>
              <h2 className="text-sm font-600">Secure card payment</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                You'll be redirected to Stripe to enter your card and delivery details safely.
              </p>
            </div>
            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
            )}
            <button
              onClick={handleStripePay}
              disabled={!ready || createSession.isPending}
              className="w-full rounded-full bg-primary px-6 py-3 text-sm font-600 text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {createSession.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> Starting payment…
                </span>
              ) : (
                `Pay ${formatPrice(total)}`
              )}
            </button>
            <p className="text-center text-xs text-muted-foreground">
              Powered by Stripe. Your card details never touch our servers.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border/70 bg-card p-4">
            <div>
              <h2 className="text-sm font-600">Delivery details</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                This is a demo checkout — no real payment is taken and no card details are requested.
              </p>
            </div>

            <Field label="Full name" value={form.deliveryName} onChange={(v) => set("deliveryName", v)} autoComplete="name" />
            <Field label="Address line 1" value={form.deliveryAddress1} onChange={(v) => set("deliveryAddress1", v)} autoComplete="address-line1" />
            <Field label="Address line 2 (optional)" value={form.deliveryAddress2 ?? ""} onChange={(v) => set("deliveryAddress2", v)} autoComplete="address-line2" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Town / city" value={form.deliveryCity} onChange={(v) => set("deliveryCity", v)} autoComplete="address-level2" />
              <Field label="Postcode" value={form.deliveryPostcode} onChange={(v) => set("deliveryPostcode", v)} autoComplete="postal-code" />
            </div>
            <Field label="Contact email" type="email" value={form.contactEmail} onChange={(v) => set("contactEmail", v)} autoComplete="email" />

            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
            )}

            <button
              type="submit"
              disabled={pending || !ready}
              className="w-full rounded-full bg-primary px-6 py-3 text-sm font-600 text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {pending ? "Placing order…" : `Pay ${formatPrice(total)}`}
            </button>
          </form>
        )}

        {/* Order summary */}
        <div className="rounded-xl border border-border/70 bg-card p-4">
          <h2 className="text-sm font-600">Order summary</h2>
          {!ready ? (
            <div className="mt-3 space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : (
            <>
              <ul className="mt-3 space-y-3">
                {summaryItems.map((it) => (
                  <li key={it.id} className="flex items-center gap-3">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {it.image ? (
                        <img src={mediaUrl(it.image)} alt={it.title} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-600">{it.title}</p>
                      {it.brand && <p className="text-xs text-muted-foreground">{it.brand}</p>}
                    </div>
                    <span className="text-sm font-600">{formatPrice(it.price)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 border-t border-border pt-3">
                {acceptedOffer.data && singleListing.data && acceptedOffer.data.price < singleListing.data.price && (
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Listed price</span>
                    <span className="text-muted-foreground line-through">
                      {formatPrice(singleListing.data.price)}
                    </span>
                  </div>
                )}
                {acceptedOffer.data && (
                  <div className="mb-2 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-600 text-primary">
                    Accepted offer price
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-serif text-lg font-700">{formatPrice(total)}</span>
                </div>
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <ShieldCheck size={16} className="mt-0.5 shrink-0" />
                <p>
                  {stripeEnabled
                    ? "Payments are processed by Stripe. The seller is notified and the item marked sold once payment is confirmed."
                    : "Demo marketplace — no money changes hands. The seller is notified and the item is marked sold."}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-600 text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={type !== "text" || !label.toLowerCase().includes("optional")}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
      />
    </label>
  );
}
