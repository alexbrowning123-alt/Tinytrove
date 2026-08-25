import { CheckCircle2, MessageCircle, Package } from "lucide-react";
import { useParams, useLocation } from "wouter";
import { useOrder, useStartThread, useMe } from "@/lib/hooks";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice, mediaUrl } from "@/components/common";

export default function OrderConfirmation() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data: order, isLoading } = useOrder(id);
  const me = useMe();
  const [, navigate] = useLocation();
  const startThread = useStartThread();

  if (!me.isLoading && !me.data) {
    setTimeout(() => {
      if (window.location.hash !== "#/login") window.location.hash = "#/login";
    }, 0);
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center text-sm text-muted-foreground">
        Log in to view your order.
      </div>
    );
  }

  if (isLoading || !order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  const address = [
    order.deliveryName,
    order.deliveryAddress1,
    order.deliveryAddress2,
    `${order.deliveryCity}, ${order.deliveryPostcode}`,
  ].filter(Boolean);

  const handleMessage = (listingId: number, title: string) => {
    startThread.mutate(
      { listingId, initialMessage: `Hi! I've just placed order #${order.id} for "${title}". When would you be able to post it?` },
      { onSuccess: (thread) => navigate(`/inbox/${thread.id}`) },
    );
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-5 md:pb-12">
      <div className="flex flex-col items-center text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-chart-2/15">
          <CheckCircle2 size={32} className="text-chart-2" />
        </div>
        <h1 className="mt-3 font-serif text-2xl font-700">Order placed</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Thanks{order.deliveryName ? `, ${order.deliveryName.split(" ")[0]}` : ""}! Order <span className="font-600 text-foreground">#{order.id}</span>{" is confirmed."}
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-border/70 bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-600">
          <Package size={16} className="text-muted-foreground" /> Items
        </div>
        <ul className="mt-3 space-y-3">
          {order.items.map((it) => (
            <li key={it.id} className="flex items-center gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                {it.image ? <img src={mediaUrl(it.image)} alt={it.title} className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-600">{it.title}</p>
                <p className="text-xs text-muted-foreground">Sold by {it.sellerName}</p>
              </div>
              <span className="text-sm font-600">{formatPrice(it.price)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
          <span className="text-muted-foreground">Total</span>
          <span className="font-serif text-lg font-700">{formatPrice(order.total)}</span>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-border/70 bg-card p-4 text-sm">
        <p className="font-600">Delivering to</p>
        <p className="mt-1 text-muted-foreground">{address.join(", ")}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          A confirmation has been sent to {order.contactEmail}. This is a demo order — no payment was taken.
        </p>
      </div>

      {/* Message each seller to arrange postage */}
      <div className="mt-6">
        <p className="text-sm font-600">Arrange postage with your seller(s)</p>
        <div className="mt-3 space-y-2">
          {order.items.map((it) => (
            <button
              key={`msg-${it.id}`}
              onClick={() => handleMessage(it.listingId, it.title)}
              disabled={startThread.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-600 transition hover:bg-muted"
            >
              <MessageCircle size={16} /> Message {it.sellerName} about "{it.title}"
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => navigate("/orders")}
        className="mt-4 w-full rounded-full bg-primary px-6 py-3 text-sm font-600 text-primary-foreground transition hover:bg-primary/90"
      >
        View your orders
      </button>
    </div>
  );
}
