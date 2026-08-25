import { Package, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { useOrders, useMe, useCancelOrder } from "@/lib/hooks";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice, mediaUrl, timeAgo } from "@/components/common";

export default function Orders() {
  const { data, isLoading } = useOrders();
  const me = useMe();
  const cancelOrder = useCancelOrder();

  if (!me.isLoading && !me.data) {
    setTimeout(() => {
      if (window.location.hash !== "#/login") window.location.hash = "#/login";
    }, 0);
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center text-sm text-muted-foreground">
        Log in to see your orders.
      </div>
    );
  }

  const orders = data ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-5 md:pb-12">
      <h1 className="font-serif text-xl font-700">Your orders</h1>
      <p className="mt-1 text-sm text-muted-foreground">Everything you've checked out on TinyTrove.</p>

      {isLoading ? (
        <div className="mt-5 space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : orders.length > 0 ? (
        <ul className="mt-5 space-y-3">
          {orders.map((o) => (
            <li
              key={o.id}
              className="rounded-xl border border-border/70 bg-card p-4 transition hover:bg-muted/50"
            >
              <div className="flex items-center justify-between">
                <Link href={`/order/${o.id}`} className="font-600 hover:underline">
                  Order #{o.id}
                </Link>
                <span className="text-xs text-muted-foreground">{timeAgo(o.createdAt)}</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                {o.items.slice(0, 4).map((it) => (
                  <div key={it.id} className="h-10 w-10 overflow-hidden rounded-md bg-muted">
                    {it.image ? <img src={mediaUrl(it.image)} alt={it.title} className="h-full w-full object-cover" /> : null}
                  </div>
                ))}
                <span className="ml-1 text-xs text-muted-foreground">
                  {o.items.length} item{o.items.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-sm">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-chart-2/15 px-2.5 py-0.5 text-xs font-600 text-chart-2">
                  <Package size={12} /> {o.status === "completed" ? "Completed" : o.status}
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-serif font-700">{formatPrice(o.total)}</span>
                  <button
                    type="button"
                    disabled={cancelOrder.isPending}
                    onClick={() => cancelOrder.mutate(o.id)}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-destructive disabled:opacity-50"
                  >
                    <Trash2 size={13} /> Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-5 py-16 text-center">
          <Package size={32} className="mx-auto text-muted-foreground/40" />
          <p className="mt-3 font-serif text-lg font-600">No orders yet</p>
          <p className="mt-1 text-sm text-muted-foreground">When you check out, your purchases will appear here.</p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-full bg-primary px-5 py-2.5 text-sm font-600 text-primary-foreground"
          >
            Browse items
          </Link>
        </div>
      )}
    </div>
  );
}
