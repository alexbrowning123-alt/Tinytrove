import { Link } from "wouter";

// Re-exported so components can resolve uploaded-image URLs in one place.
export { mediaUrl } from "@/lib/queryClient";

export function formatPrice(value: number) {
  return "£" + value.toFixed(value % 1 === 0 ? 0 : 2);
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return "just now";
}

export function formatMessageTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return time;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) + " " + time;
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 ${className}`} aria-label="TinyTrove home">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <svg width="22" height="22" viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <path d="M20 18C20 16.9 20.9 16 22 16h20c1.1 0 2 0.9 2 2v2H20v-2Z" fill="currentColor" />
          <rect x="16" y="22" width="32" height="18" rx="3" fill="currentColor" />
          <path d="M24 40s-2 6-4 8h24c-2-2-4-8-4-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <circle cx="25" cy="52" r="4" fill="currentColor" />
          <circle cx="39" cy="52" r="4" fill="currentColor" />
        </svg>
      </span>
      <span className="font-serif text-xl font-600 tracking-tight text-foreground">
        Tiny<span className="text-primary">Trove</span>
      </span>
    </Link>
  );
}

export function Avatar({
  name,
  color,
  size = 40,
}: {
  name: string;
  color: string;
  size?: number;
}) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter((c) => /[a-zA-Z]/.test(c ?? ""))
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-600 text-white"
      style={{
        backgroundColor: color,
        width: size,
        height: size,
        fontSize: size * 0.38,
      }}
      aria-hidden="true"
    >
      {initials || "U"}
    </span>
  );
}

export function StarRating({ rating, reviews }: { rating: number; reviews?: number }) {
  const full = Math.round(rating);
  return (
    <span className="inline-flex items-center gap-1 text-foreground">
      <span className="inline-flex" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <svg
            key={i}
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill={i < full ? "hsl(var(--chart-3))" : "hsl(var(--muted-foreground) / 0.3)"}
          >
            <path d="M12 2l2.9 6.3 6.8.8-5 4.7 1.3 6.7L12 17.8 6 20.5l1.3-6.7-5-4.7 6.8-.8L12 2z" />
          </svg>
        ))}
      </span>
      <span className="text-xs font-600">{rating.toFixed(1)}</span>
      {reviews != null && <span className="text-xs text-muted-foreground">({reviews})</span>}
    </span>
  );
}

export function ConditionBadge({ condition }: { condition: string }) {
  const dot =
    condition === "New with tags"
      ? "bg-primary"
      : condition === "New without tags"
      ? "bg-chart-4"
      : condition === "Very good"
      ? "bg-chart-3"
      : condition === "Good"
      ? "bg-chart-2"
      : "bg-muted-foreground/70";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/85 px-2.5 py-0.5 text-xs font-500 text-muted-foreground backdrop-blur-sm">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {condition}
    </span>
  );
}
