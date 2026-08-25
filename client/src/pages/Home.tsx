import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { useListings } from "@/lib/hooks";
import { useSearch } from "@/lib/search-context";
import { ListingCard } from "@/components/ListingCard";
import { CATEGORIES, CONDITIONS, AGE_RANGES } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
];

export default function Home() {
  const { q } = useSearch();
  const [category, setCategory] = useState("All");
  const [ageRange, setAgeRange] = useState("All");
  const [condition, setCondition] = useState("All");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [sort, setSort] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);

  const filters: Record<string, string | undefined> = {
    q: q || undefined,
    category,
    ageRange,
    condition,
    maxPrice: maxPrice || undefined,
    sort,
  };

  const { data, isLoading } = useListings(filters);

  const reset = () => {
    setCategory("All");
    setAgeRange("All");
    setCondition("All");
    setMaxPrice("");
    setSort("newest");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-5 md:pb-12">
      {/* Hero */}
      <div className="relative min-h-[200px] overflow-hidden rounded-2xl border border-border/60 bg-primary text-primary-foreground shadow-sm sm:min-h-[240px]">
        <img
          src="/images/hero-flatlay.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover opacity-65 mix-blend-luminosity sm:h-full"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/75 to-primary/25" />
        <div className="relative z-10 max-w-lg p-6 sm:p-8">
          <p className="text-xs font-600 uppercase tracking-[0.14em] text-primary-foreground/75">
            A curated marketplace for little ones
          </p>
          <h1 className="mt-2.5 font-serif text-2xl italic font-500 leading-[1.15] sm:text-3xl">
            Give your child’s items a second chance.
          </h1>
          <p className="mt-2 text-sm text-primary-foreground/85 sm:text-base">
            A sustainable marketplace dedicated to parents.
          </p>
          <a
            href="#/sell"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-background px-5 py-2.5 text-sm font-600 text-foreground shadow-sm transition hover:bg-background/90"
          >
            List an item
          </a>
        </div>
      </div>

      {/* Category chips */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {["All", ...CATEGORIES].map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            data-testid={`chip-category-${c}`}
            className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-500 transition ${
              category === c
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground/80 hover:bg-muted"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Loading…" : `${data?.length ?? 0} items`}
          {q ? ` for "${q}"` : ""}
        </p>
        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            data-testid="select-sort"
            className="rounded-full border border-border bg-card px-3 py-1.5 text-sm font-500 outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowFilters((s) => !s)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-500 ${
              showFilters ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground/80"
            }`}
          >
            <SlidersHorizontal size={14} />
            Filters
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="mt-3 rounded-xl border border-border bg-card p-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs font-600 text-muted-foreground">Age range</span>
              <select
                value={ageRange}
                onChange={(e) => setAgeRange(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
              >
                <option value="All">All ages</option>
                {AGE_RANGES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-600 text-muted-foreground">Condition</span>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
              >
                <option value="All">Any condition</option>
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-600 text-muted-foreground">Max price (£)</span>
              <input
                type="number"
                min="0"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Any"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
              />
            </label>
          </div>
          <button
            onClick={reset}
            className="mt-3 inline-flex items-center gap-1 text-sm font-500 text-primary hover:underline"
          >
            <X size={14} /> Reset filters
          </button>
        </div>
      )}

      {/* Grid */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <Skeleton className="aspect-square w-full rounded-none" />
              <div className="space-y-2 p-3.5">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))
        ) : data && data.length > 0 ? (
          data.map((l) => <ListingCard key={l.id} listing={l} />)
        ) : (
          <div className="col-span-full py-16 text-center">
            <p className="font-serif text-lg font-600">No items found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try adjusting your filters or search.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
