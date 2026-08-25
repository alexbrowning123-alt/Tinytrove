import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Search, Heart, MessageCircle, Plus, Sun, Moon, LogIn, User as UserIcon, ShoppingCart } from "lucide-react";
import { Logo, Avatar } from "./common";
import { useThreads, useCart, useMe } from "@/lib/hooks";

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches)
      return "dark";
    return "light";
  });

  const apply = (t: "light" | "dark") => {
    document.documentElement.classList.toggle("dark", t === "dark");
    setTheme(t);
  };

  // apply on mount
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }

  return (
    <button
      onClick={() => apply(theme === "dark" ? "light" : "dark")}
      aria-label="Toggle dark mode"
      className="grid h-9 w-9 place-items-center rounded-full text-foreground/80 hover:bg-muted"
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

const navItems = [
  { href: "/", label: "Browse", icon: Search, match: (p: string) => p === "/" || p.startsWith("/listing") },
  { href: "/sell", label: "Sell", icon: Plus, match: (p: string) => p.startsWith("/sell") },
  { href: "/favorites", label: "Saved", icon: Heart, match: (p: string) => p.startsWith("/favorites") },
  { href: "/cart", label: "Basket", icon: ShoppingCart, match: (p: string) => p.startsWith("/cart") || p.startsWith("/checkout") || p.startsWith("/order") },
  { href: "/inbox", label: "Inbox", icon: MessageCircle, match: (p: string) => p.startsWith("/inbox") },
  { href: "/profile", label: "Profile", icon: UserIcon, match: (p: string) => p.startsWith("/profile") || p.startsWith("/orders") },
];

export function Header({ onSearch }: { onSearch: (q: string) => void }) {
  const [location] = useLocation();
  const [q, setQ] = useState("");
  const threads = useThreads();
  const cart = useCart();
  const me = useMe();
  const unread = threads.data?.length ?? 0;
  const cartCount = cart.data?.length ?? 0;
  const authed = !!me.data;

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Logo />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSearch(q);
          }}
          className="hidden flex-1 md:block"
        >
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search for clothes, toys, prams…"
              data-testid="input-search"
              className="w-full rounded-full border border-border bg-muted/50 py-2 pl-9 pr-4 text-sm outline-none transition focus:border-primary focus:bg-background"
            />
          </div>
        </form>

        <div className="ml-auto flex items-center gap-1">
          {navItems.slice(0, 5).map((item) => {
            const active = item.match(location);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-500 text-foreground/80 hover:bg-muted sm:inline-flex"
              >
                <item.icon size={16} />
                <span>{item.label}</span>
                {item.href === "/inbox" && unread > 0 && (
                  <span className="grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-700 text-primary-foreground">
                    {unread}
                  </span>
                )}
                {item.href === "/cart" && cartCount > 0 && (
                  <span className="grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-700 text-primary-foreground">
                    {cartCount}
                  </span>
                )}
              </Link>
            );
          })}
          <Link
            href="/sell"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-600 text-primary-foreground transition hover:bg-primary/90"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Sell</span>
          </Link>
          {authed ? (
            <Link
              href="/profile"
              aria-label="Your profile"
              className="ml-1 hidden sm:inline-flex"
            >
              <Avatar
                name={me.data!.displayName}
                color={me.data!.avatarColor}
                size={32}
              />
            </Link>
          ) : (
            <Link
              href="/login"
              className="hidden rounded-full border border-border px-4 py-2 text-sm font-600 sm:inline-flex"
            >
              Log in
            </Link>
          )}
          <ThemeToggle />
        </div>
      </div>

      {/* Mobile search */}
      <div className="border-t border-border/50 px-4 py-2 md:hidden">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSearch(q);
            }}
            placeholder="Search…"
            data-testid="input-search-mobile"
            className="w-full rounded-full border border-border bg-muted/50 py-2 pl-9 pr-4 text-sm outline-none"
          />
        </div>
      </div>
    </header>
  );
}

export function MobileNav() {
  const [location] = useLocation();
  const me = useMe();
  const cart = useCart();
  const authed = !!me.data;
  const items = authed ? navItems : navItems.filter((i) => i.href !== "/profile");
  const cartCount = cart.data?.length ?? 0;
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-background/95 backdrop-blur-md md:hidden">
      {items.map((item) => {
        const active = item.match(location);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-500 ${
              active ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
            {item.href === "/inbox" && (useThreads().data?.length ?? 0) > 0 && (
              <span className="absolute right-1/4 top-1.5 h-2 w-2 rounded-full bg-primary" />
            )}
            {item.href === "/cart" && cartCount > 0 && (
              <span className="absolute right-1/4 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-700 text-primary-foreground">
                {cartCount}
              </span>
            )}
          </Link>
        );
      })}
      {!authed && (
        <Link href="/login" className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-500 text-muted-foreground">
          <LogIn size={20} />
          <span>Log in</span>
        </Link>
      )}
    </nav>
  );
}
