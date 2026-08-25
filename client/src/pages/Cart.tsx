import { Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { useCart, useRemoveFromCart, useMe } from "@/lib/hooks";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice, mediaUrl } from "@/components/common";

export default function Cart() {
  const { data, isLoading } = useCart();
  const remove = useRemoveFromCart();
  const me = useMe();

  if (!me.isLoading && !me.data) {
    setTimeout(() => {
      if (window.location.hash !== "#/login") window.location.hash = "#/login";
    }, 0);
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center text-sm text-muted-foreground">
        Log in to see your basket.
      </div>
    );
  }

  const items = data ?? [];
  const total = items.reduce((sum, i) => sum + (i.listing?.price ?? 0), 0);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-5 md:pb-12">
      <h1 className="font-serif text-xl font-700">Your basket</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {items.length > 0 ? `${items.length} item${items.length > 1 ? "s" : ""} ready to check out.` : "Nothing here yet."}
      </p>

      {isLoading ? (
        <div className="mt-5 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length > 0 ? (
        <>
          <ul className="mt-5 space-y-3">
            {items.map((item) => {
              const listing = item.listing;
              if (!listing) return null;
              const imgs: string[] = (listing as any).imageList ?? [];
              return (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-3"
                >
                  <Link
                    href={`/listing/${listing.id}`}
                    className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted"
                  >
                    {imgs[0] ? (
                      <img src={mediaUrl(imgs[0])} alt={listing.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-muted-foreground">
                        <ShoppingBag size={20} />
                      </div>
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/listing/${listing.id}`} className="block truncate font-600 hover:underline">
                      {listing.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {listing.brand} · {listing.condition}
                    </p>
                    <p className="mt-1 font-serif text-base font-600">{formatPrice(listing.price)}</p>
                  </div>
                  <button
                    onClick={() => remove.mutate(item.id)}
                    disabled={remove.isPending}
                    aria-label="Remove from basket"
                    className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-destructive"
                  >
                    <Trash2 size={18} />
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-5 rounded-xl border border-border/70 bg-card p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-serif text-lg font-700">{formatPrice(total)}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Demo checkout — no real payment is taken. Items are marked sold in TinyTrove.
            </p>
            <Link
              href="/checkout"
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-600 text-primary-foreground transition hover:bg-primary/90"
            >
              Proceed to checkout <ArrowRight size={16} />
            </Link>
          </div>
        </>
      ) : (
        <div className="mt-5 py-16 text-center">
          <ShoppingBag size={32} className="mx-auto text-muted-foreground/40" />
          <p className="mt-3 font-serif text-lg font-600">Your basket is empty</p>
          <p className="mt-1 text-sm text-muted-foreground">Add items from the browse page to get started.</p>
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
