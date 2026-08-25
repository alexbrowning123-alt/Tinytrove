import { Heart } from "lucide-react";
import { useFavorites, useMe } from "@/lib/hooks";
import { ListingCard } from "@/components/ListingCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

export default function Favorites() {
  const { data, isLoading } = useFavorites();
  const me = useMe();

  if (!me.isLoading && !me.data) {
    setTimeout(() => {
      if (window.location.hash !== "#/login") window.location.hash = "#/login";
    }, 0);
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center text-sm text-muted-foreground">
        Log in to see your saved items.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-5 md:pb-12">
      <h1 className="font-serif text-xl font-700">Saved items</h1>
      <p className="mt-1 text-sm text-muted-foreground">Everything you've hearted, in one place.</p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-border/70 bg-card">
              <Skeleton className="aspect-square w-full rounded-none" />
              <div className="space-y-2 p-3">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ))
        ) : data && data.length > 0 ? (
          data.map((f) => f.listing && <ListingCard key={f.id} listing={{ ...f.listing, seller: undefined }} />)
        ) : (
          <div className="col-span-full py-16 text-center">
            <Heart size={32} className="mx-auto text-muted-foreground/40" />
            <p className="mt-3 font-serif text-lg font-600">No saved items yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Tap the heart on any item to save it here.</p>
            <Link
              href="/"
              className="mt-4 inline-block rounded-full bg-primary px-5 py-2.5 text-sm font-600 text-primary-foreground"
            >
              Browse items
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
