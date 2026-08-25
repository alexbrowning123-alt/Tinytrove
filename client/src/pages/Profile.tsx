import { useState } from "react";
import { Link } from "wouter";
import { MapPin, Calendar, Package, LogOut } from "lucide-react";
import { useMe, useSellerListings, useUser, useRelistListing, useLogout } from "@/lib/hooks";
import { useParams } from "wouter";
import { Avatar, StarRating, ConditionBadge, formatPrice, timeAgo, mediaUrl } from "@/components/common";
import { Skeleton } from "@/components/ui/skeleton";

export function ProfileHeader({
  name,
  color,
  location,
  joinedAt,
  rating,
  reviews,
  bio,
  isMe,
}: {
  name: string;
  color: string;
  location: string;
  joinedAt: string;
  rating: number;
  reviews: number;
  bio: string;
  isMe?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-4">
        <Avatar name={name} color={color} size={60} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-xl font-700">{name}</h1>
            {isMe && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-600 text-primary">
                You
              </span>
            )}
          </div>
          <StarRating rating={rating} reviews={reviews} />
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin size={12} /> {location}
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar size={12} /> Joined{" "}
              {new Date(joinedAt).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
            </span>
          </p>
        </div>
      </div>
      {bio && <p className="mt-3 text-sm text-foreground/90">{bio}</p>}
    </div>
  );
}

export function ListingsList({ items, own = false }: { items: import("@shared/schema").Listing[]; own?: boolean }) {
  const relist = useRelistListing();
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-12 text-center">
        <Package size={28} className="mx-auto text-muted-foreground/40" />
        <p className="mt-3 font-serif text-base font-600">No listings yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Nothing here right now.</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {items.map((l) => (
        <li key={l.id}>
          <div className="flex items-center gap-3 py-3 transition hover:bg-muted/40">
            <Link href={`/listing/${l.id}`} className="flex min-w-0 flex-1 items-center gap-3">
              <div className="h-16 w-16 overflow-hidden rounded-lg bg-muted">
                {((l as any).imageList ?? [])[0] && (
                  <img
                    src={mediaUrl(((l as any).imageList as string[])[0])}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-600 text-sm">{l.title}</p>
                <p className="text-xs text-muted-foreground">
                  {l.brand} · {l.category}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <ConditionBadge condition={l.condition} />
                  <span className="text-xs text-muted-foreground">Listed {timeAgo(l.createdAt)}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="font-600">{formatPrice(l.price)}</p>
                {l.status === "sold" && (
                  <span className="text-xs font-600 text-muted-foreground">Sold</span>
                )}
              </div>
            </Link>
            {own && l.status === "sold" && (
              <button
                type="button"
                disabled={relist.isPending}
                onClick={() => relist.mutate(l.id)}
                className="shrink-0 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-600 transition hover:bg-muted disabled:opacity-50"
              >
                Relist
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-border/70 bg-card px-3 py-2.5 text-center text-sm font-600 transition hover:bg-muted"
    >
      {label}
    </Link>
  );
}

export default function Profile() {
  const me = useMe();
  const logout = useLogout();

  if (!me.isLoading && !me.data) {
    setTimeout(() => {
      if (window.location.hash !== "#/login") window.location.hash = "#/login";
    }, 0);
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-sm text-muted-foreground">
        Log in to view your profile.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-5 md:pb-12">
      {me.data ? (
        <ProfileHeader
          name={me.data.displayName}
          color={me.data.avatarColor}
          location={me.data.location}
          joinedAt={me.data.joinedAt}
          rating={me.data.rating}
          reviews={me.data.reviews}
          bio={me.data.bio ?? ""}
          isMe
        />
      ) : (
        <Skeleton className="h-32 w-full rounded-xl" />
      )}

      {/* Quick links */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <QuickLink href="/orders" label="Your orders" />
        <QuickLink href="/cart" label="Basket" />
        <QuickLink href="/favorites" label="Saved" />
      </div>

      {me.data && <PayoutsCard />}

      {me.data && (
        <button
          type="button"
          disabled={logout.isPending}
          onClick={() =>
            logout.mutate(undefined, {
              onSuccess: () => {
                window.location.hash = "#/login";
              },
            })
          }
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm font-600 text-destructive transition hover:bg-destructive/10 disabled:opacity-50"
        >
          <LogOut size={16} /> Log out
        </button>
      )}

      <div className="mt-6 flex items-center justify-between">
        <h2 className="font-serif text-lg font-600">Your listings</h2>
        <Link
          href="/sell"
          className="rounded-full bg-primary px-4 py-2 text-sm font-600 text-primary-foreground"
        >
          + New listing
        </Link>
      </div>

      <div className="mt-3">
        {me.data ? (
          <YourListings userId={me.data.id} />
        ) : (
          <Skeleton className="aspect-square w-full rounded-xl" />
        )}
      </div>
    </div>
  );
}

function YourListings({ userId }: { userId: number }) {
  const listings = useSellerListings(userId);
  if (listings.isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square w-full rounded-xl" />
        ))}
      </div>
    );
  }
  return <ListingsList items={listings.data ?? []} own />;
}

export function SellerProfile() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? "1";
  const user = useUser(id);
  const listings = useSellerListings(id);

  if (user.isLoading || !user.data) {
    return (
      <div className="mx-auto max-w-4xl px-4 pb-24 pt-5 md:pb-12">
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  const u = user.data;
  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-5 md:pb-12">
      <ProfileHeader
        name={u.displayName}
        color={u.avatarColor}
        location={u.location}
        joinedAt={u.joinedAt}
        rating={u.rating}
        reviews={u.reviews}
        bio={u.bio ?? ""}
      />
      <h2 className="mt-6 font-serif text-lg font-600">Listings</h2>
      <div className="mt-3">
        {listings.isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <ListingsList items={listings.data ?? []} />
        )}
      </div>
    </div>
  );
}

// Seller payouts via Stripe Connect. Hidden entirely when Stripe isn't
// configured (e.g. before the platform goes live). Lets a seller connect their
// own Stripe account so buyers can pay them directly.
function PayoutsCard() {
  const status = useStripeStatus();
  const onboard = useStripeOnboard();
  const [error, setError] = useState<string | null>(null);

  if (status.isLoading) {
    return (
      <div className="mt-4 rounded-xl border border-border/70 bg-card p-4 text-sm text-muted-foreground">
        Checking payout setup…
      </div>
    );
  }
  if (!status.data?.enabled) return null;

  const connected = !!status.data.connected;
  const ready = !!status.data.chargesEnabled;

  const start = () => {
    setError(null);
    onboard.mutate(undefined, {
      onError: (e: Error) => {
        const msg = (e.message || "").includes(":")
          ? e.message.split(":").slice(1).join(":").trim()
          : e.message;
        setError(msg || "Couldn't start Stripe setup.");
      },
    });
  };

  return (
    <div className="mt-4 rounded-xl border border-border/70 bg-card p-4">
      <div className="flex items-center gap-2">
        <Wallet size={16} className="text-primary" />
        <h2 className="text-sm font-600">Payouts</h2>
      </div>
      {ready ? (
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 size={15} className="text-primary" />
          Stripe connected — you can accept paid offers.
        </div>
      ) : connected ? (
        <div className="mt-2">
          <p className="text-sm text-muted-foreground">
            Your Stripe account needs finishing before you can accept paid offers.
          </p>
          <button
            onClick={start}
            disabled={onboard.isPending}
            className="mt-3 w-full rounded-full bg-primary px-6 py-2.5 text-sm font-600 text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {onboard.isPending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={15} className="animate-spin" /> Opening Stripe…
              </span>
            ) : (
              "Finish Stripe setup"
            )}
          </button>
        </div>
      ) : (
        <div className="mt-2">
          <p className="text-sm text-muted-foreground">
            Connect a Stripe account to receive payments when your items sell.
          </p>
          <button
            onClick={start}
            disabled={onboard.isPending}
            className="mt-3 w-full rounded-full bg-primary px-6 py-2.5 text-sm font-600 text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {onboard.isPending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={15} className="animate-spin" /> Opening Stripe…
              </span>
            ) : (
              "Set up payouts"
            )}
          </button>
        </div>
      )}
      {error && (
        <p className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
