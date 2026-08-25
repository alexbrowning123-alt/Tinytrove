import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import {
  Heart,
  MessageCircle,
  Shield,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Truck,
  ArrowLeft,
  Tag,
  Pencil,
  Plus,
} from "lucide-react";
import { useListing, useToggleFavorite, useFavorites, useStartThread, useAddToCart, useAcceptedOffer, useRelistListing, useMe } from "@/lib/hooks";
import { Avatar, StarRating, ConditionBadge, formatPrice, timeAgo, mediaUrl } from "@/components/common";
import { Skeleton } from "@/components/ui/skeleton";

export default function ListingDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data: listing, isLoading } = useListing(id);
  const toggleFav = useToggleFavorite();
  const favQuery = useFavorites();
  const startThread = useStartThread();
  const addToCart = useAddToCart();
  const me = useMe();
  const acceptedOffer = useAcceptedOffer(listing?.id);
  const relist = useRelistListing();
  const [activeImg, setActiveImg] = useState(0);
  const [, navigate] = useLocation();

  const isFav = (favQuery.data ?? []).some((f) => f.listingId === Number(id));

  if (isLoading || !listing) {
    return (
      <div className="mx-auto max-w-5xl px-4 pb-24 pt-5 md:pb-12">
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <div className="space-y-3">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const images: string[] = (listing as any).imageList ?? [];
  const seller = listing.seller;
  const isOwner = !!(seller && me.data && seller.id === me.data.id);

  const handleMessage = () => {
    if (!seller) return;
    if (!me.data) {
      window.location.hash = "#/login";
      return;
    }
    startThread.mutate(
      { listingId: listing.id },
      { onSuccess: (thread) => navigate(`/inbox/${thread.id}`) },
    );
  };

  const handleBuy = () => {
    if (!me.data) {
      window.location.hash = "#/login";
      return;
    }
    navigate(`/checkout/${listing.id}`);
  };

  const handleAddToCart = () => {
    if (!me.data) {
      window.location.hash = "#/login";
      return;
    }
    addToCart.mutate(listing.id, {
      onSuccess: () => navigate("/cart"),
    });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-4 md:pb-12">
      <Link
        href="/"
        className="mb-3 inline-flex items-center gap-1 text-sm font-500 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} /> Back to browse
      </Link>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Images */}
        <div>
          <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card">
            {images.length > 0 ? (
              <img
                src={mediaUrl(images[activeImg])}
                alt={listing.title}
                className="aspect-square w-full object-cover"
              />
            ) : (
              <div className="flex aspect-square items-center justify-center text-muted-foreground">
                No image
              </div>
            )}
            {images.length > 1 && (
              <>
                <button
                  onClick={() => setActiveImg((i) => (i - 1 + images.length) % images.length)}
                  className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-background/80 backdrop-blur-xs hover:bg-background"
                  aria-label="Previous image"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={() => setActiveImg((i) => (i + 1) % images.length)}
                  className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-background/80 backdrop-blur-xs hover:bg-background"
                  aria-label="Next image"
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}
            <button
              onClick={() => {
                if (!me.data) {
                  window.location.hash = "#/login";
                  return;
                }
                toggleFav.mutate(listing.id);
              }}
              className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-background/90 backdrop-blur-xs hover:bg-background"
              aria-label={isFav ? "Remove from favourites" : "Save to favourites"}
            >
              <Heart size={20} className={isFav ? "fill-primary text-primary" : "text-foreground"} />
            </button>
          </div>
          {images.length > 1 && (
            <div className="mt-2 flex gap-2">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  className={`h-16 w-16 overflow-hidden rounded-lg border-2 ${
                    activeImg === i ? "border-primary" : "border-transparent"
                  }`}
                >
                  <img src={mediaUrl(img)} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          {listing.brand && (
            <p className="text-xs font-600 uppercase tracking-[0.14em] text-muted-foreground">
              {listing.brand}
            </p>
          )}
          <h1 className="mt-2 font-serif text-2xl font-600 leading-tight tracking-tight sm:text-[28px]">
            {listing.title}
          </h1>
          <div className="mt-3 flex items-center gap-3">
            <span className="font-serif text-3xl font-700 leading-none text-foreground">
              {formatPrice(listing.price)}
            </span>
            <ConditionBadge condition={listing.condition} />
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            {listing.category} · Listed {timeAgo(listing.createdAt)}
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 rounded-2xl border border-border/60 bg-card p-5">
            <div>
              <dt className="text-xs font-600 uppercase tracking-wider text-muted-foreground">Age range</dt>
              <dd className="mt-0.5 text-sm font-500 text-foreground">{listing.ageRange}</dd>
            </div>
            <div>
              <dt className="text-xs font-600 uppercase tracking-wider text-muted-foreground">Size</dt>
              <dd className="mt-0.5 text-sm font-500 text-foreground">{listing.size && listing.size !== "-" ? listing.size : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-600 uppercase tracking-wider text-muted-foreground">Category</dt>
              <dd className="mt-0.5 text-sm font-500 text-foreground">{listing.category}</dd>
            </div>
            <div>
              <dt className="text-xs font-600 uppercase tracking-wider text-muted-foreground">Condition</dt>
              <dd className="mt-0.5 text-sm font-500 text-foreground">{listing.condition}</dd>
            </div>
          </dl>

          <div className="mt-6">
            <h2 className="text-xs font-600 uppercase tracking-wider text-muted-foreground">Description</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground/90">{listing.description}</p>
          </div>

          {/* Actions */}
          {listing.status === "sold" ? (
            <div className="mt-6 rounded-full bg-muted px-6 py-3 text-center text-sm font-600 text-muted-foreground">
              This item has been sold
            </div>
          ) : listing.status === "reserved" ? (
            acceptedOffer.data ? (
              <div className="mt-6 flex flex-col gap-2">
                <div className="rounded-full bg-primary/10 px-6 py-3 text-center text-sm font-600 text-primary">
                  Offer accepted at {formatPrice(acceptedOffer.data.price)} — complete checkout
                </div>
                <button
                  onClick={handleBuy}
                  className="flex-1 rounded-full bg-primary px-6 py-3 text-sm font-600 text-primary-foreground transition hover:bg-primary/90"
                >
                  Complete checkout
                </button>
              </div>
            ) : isOwner ? (
              <div className="mt-6 flex flex-col gap-2">
                <div className="rounded-full bg-amber-500/10 px-6 py-3 text-center text-sm font-600 text-amber-600 dark:text-amber-400">
                  Reserved — awaiting the buyer’s checkout
                </div>
                <button
                  onClick={() => relist.mutate(listing.id)}
                  disabled={relist.isPending}
                  className="flex-1 rounded-full border border-border bg-card px-6 py-3 text-sm font-600 transition hover:bg-muted disabled:opacity-50"
                >
                  {relist.isPending ? "Releasing…" : "Release reservation"}
                </button>
              </div>
            ) : (
              <div className="mt-6 rounded-full bg-muted px-6 py-3 text-center text-sm font-600 text-muted-foreground">
                This item is currently reserved
              </div>
            )
          ) : isOwner ? (
            <div className="mt-6 flex flex-col gap-2">
              <div className="rounded-full bg-emerald-500/10 px-6 py-3 text-center text-sm font-600 text-emerald-600 dark:text-emerald-400">
                Your listing is live
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => navigate("/inbox")}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-600 text-primary-foreground transition hover:bg-primary/90"
                >
                  <Tag size={16} /> Review offers
                </button>
                <button
                  onClick={() => navigate(`/sell/${listing.id}`)}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-600 transition hover:bg-muted"
                >
                  <Pencil size={16} /> Edit listing
                </button>
                <button
                  onClick={() => navigate("/sell")}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-600 transition hover:bg-muted"
                >
                  <Plus size={16} /> List another
                </button>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Buyers can message you, make offers, or buy this item. New conversations appear in your inbox.
              </p>
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={handleBuy}
                className="flex-1 rounded-full bg-primary px-6 py-3 text-sm font-600 text-primary-foreground transition hover:bg-primary/90"
              >
                Buy now
              </button>
              <button
                onClick={handleAddToCart}
                disabled={addToCart.isPending}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-600 transition hover:bg-muted"
              >
                Add to basket
              </button>
              <button
                onClick={handleMessage}
                disabled={startThread.isPending}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-600 transition hover:bg-muted"
              >
                <MessageCircle size={16} /> Message seller
              </button>
            </div>
          )}

          {/* Demo checkout note — only for buyers */}
          {!isOwner && (
            <div className="mt-6 flex items-start gap-2 rounded-xl border border-border/60 bg-muted/40 p-3 text-sm">
              <Shield size={18} className="mt-0.5 shrink-0 text-muted-foreground" />
              <p className="leading-relaxed text-foreground/70">
                <span className="font-600 text-foreground/80">Demo checkout:</span> no real payment is taken and no card
                details are requested. Buying marks the item as sold and lets you message the seller to
                arrange postage.
              </p>
            </div>
          )}

          {/* Seller card — only when viewing someone else's listing */}
          {seller && !isOwner && (
            <Link
              href={`/seller/${seller.id}`}
              className="mt-5 flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3.5 transition hover:bg-muted/50"
            >
              <Avatar name={seller.displayName} color={seller.avatarColor} size={44} />
              <div className="min-w-0 flex-1">
                <p className="font-600 text-foreground">{seller.displayName}</p>
                <StarRating rating={seller.rating} reviews={seller.reviews} />
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin size={12} /> {seller.location}
                </p>
              </div>
              <Truck size={18} className="text-muted-foreground" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
