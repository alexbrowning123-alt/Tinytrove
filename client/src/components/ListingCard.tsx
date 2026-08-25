import { Link } from "wouter";
import { Heart } from "lucide-react";
import { useToggleFavorite, useFavorites, useMe } from "@/lib/hooks";
import { Avatar, ConditionBadge, formatPrice, mediaUrl } from "./common";
import type { Listing, User } from "@shared/schema";

export function ListingCard({ listing }: { listing: Listing & { seller?: User } }) {
  const toggleFav = useToggleFavorite();
  const favQuery = useFavorites();
  const favs = favQuery.data ?? [];
  const isFav = favs.some((f) => f.listingId === listing.id);
  const me = useMe();

  const images: string[] = (listing as any).imageList ?? [];
  const cover = images[0];

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card transition duration-300 hover:border-border hover:-translate-y-0.5 hover:shadow-md">
      <Link
        href={`/listing/${listing.id}`}
        className="block"
        data-testid={`link-listing-${listing.id}`}
      >
        <div className="aspect-square overflow-hidden bg-muted">
          {cover ? (
            <img
              src={mediaUrl(cover)}
              alt={listing.title}
              loading="lazy"
              className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              No image
            </div>
          )}
        </div>
      </Link>

      <div className="pointer-events-none absolute left-2.5 top-2.5">
        <ConditionBadge condition={listing.condition} />
      </div>

      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!me.data) {
            window.location.hash = "#/login";
            return;
          }
          toggleFav.mutate(listing.id);
        }}
        aria-label={isFav ? "Remove from favourites" : "Save to favourites"}
        data-testid={`button-fav-${listing.id}`}
        className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full bg-background/85 backdrop-blur-sm transition hover:bg-background"
      >
        <Heart
          size={16}
          className={isFav ? "fill-primary text-primary" : "text-foreground"}
        />
      </button>

      <div className="p-4">
        <p className="font-serif text-base font-600 leading-none text-foreground">
          {formatPrice(listing.price)}
        </p>
        <Link href={`/listing/${listing.id}`}>
          <h3 className="mt-1.5 line-clamp-2 text-sm leading-snug text-foreground/90 transition group-hover:text-primary">
            {listing.title}
          </h3>
        </Link>
        <p className="mt-1 text-xs text-muted-foreground">
          {listing.brand} · {listing.size && listing.size !== "-" ? `Size ${listing.size}` : listing.ageRange}
        </p>
        {listing.seller && (
          <div className="mt-3 flex items-center gap-1.5 border-t border-border/50 pt-2.5">
            <Avatar name={listing.seller.displayName} color={listing.seller.avatarColor} size={16} />
            <span className="truncate text-xs text-muted-foreground/90">
              {listing.seller.location.split(",")[0]}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
