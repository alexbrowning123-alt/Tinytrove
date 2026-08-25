import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { ShieldCheck, CheckCircle2 } from "lucide-react";
import { useMe } from "@/lib/hooks";

export default function CheckoutSuccess() {
  const params = useParams<{ sessionId?: string }>();
  const [, navigate] = useLocation();
  const me = useMe();

  useEffect(() => {
    if (!me.isLoading && !me.data) {
      window.location.hash = "#/login";
    }
  }, [me]);

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <CheckCircle2 className="text-primary" size={32} />
      </div>
      <h1 className="font-serif text-2xl font-700">Payment received</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Thanks{me.data ? `, ${me.data.displayName.split(" ")[0]}` : ""} — your order is being confirmed.
        The seller has been notified and your item is reserved.
      </p>
      <div className="mt-6 rounded-xl border border-border/70 bg-card p-4 text-left text-xs text-muted-foreground">
        <div className="flex items-start gap-2">
          <ShieldCheck size={16} className="mt-0.5 shrink-0" />
          <p>
            A confirmation will appear in your messages shortly. If you paid by card, the charge will
            show on your statement from the seller's store.
          </p>
        </div>
      </div>
      <button
        onClick={() => navigate("/orders")}
        className="mt-6 w-full rounded-full bg-primary px-6 py-3 text-sm font-600 text-primary-foreground transition hover:bg-primary/90"
      >
        View my orders
      </button>
      <button
        onClick={() => navigate("/")}
        className="mt-2 w-full px-6 py-2 text-sm font-500 text-muted-foreground hover:text-foreground"
      >
        Back to browsing
      </button>
    </div>
  );
}
