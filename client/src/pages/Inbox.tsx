import { useState, useRef, useEffect } from "react";
import { Link, useParams, useLocation } from "wouter";
import { Send, ArrowLeft, MessageCircle, Trash2, Tag, Check, X, ShoppingBag } from "lucide-react";
import {
  useThreads,
  useThread,
  useMessages,
  useSendMessage,
  useDeleteMessage,
  useMakeOffer,
  useRespondOffer,
  useMe,
} from "@/lib/hooks";
import type { Offer } from "@shared/schema";
import { Avatar, formatPrice, formatMessageTime } from "@/components/common";
import { Skeleton } from "@/components/ui/skeleton";

export default function Inbox() {
  const params = useParams<{ threadId?: string }>();
  const id = params.threadId ? Number(params.threadId) : null;
  const me = useMe();
  const threads = useThreads();
  const thread = useThread(id);
  const messages = useMessages(id);
  const sendMessage = useSendMessage(id);
  const deleteMessage = useDeleteMessage(id);
  const makeOffer = useMakeOffer(id);
  const respondOffer = useRespondOffer(id);
  const [text, setText] = useState("");
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerPrice, setOfferPrice] = useState("");
  const [, navigate] = useLocation();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data]);

  if (!me.isLoading && !me.data) {
    setTimeout(() => {
      if (window.location.hash !== "#/login") window.location.hash = "#/login";
    }, 0);
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center text-sm text-muted-foreground">
        Log in to see your messages.
      </div>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || id == null) return;
    sendMessage.mutate(text.trim(), { onSuccess: () => setText("") });
  };

  const submitOffer = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(offerPrice);
    if (!Number.isFinite(amount) || amount <= 0 || id == null) return;
    makeOffer.mutate(amount, {
      onSuccess: () => {
        setOfferPrice("");
        setOfferOpen(false);
      },
    });
  };

  // The listing is still negotiable while available. Either participant can
  // make or counter an offer.
  const listingAvailable = thread.data?.listing?.status === "available";
  const isSeller = thread.data?.listing?.sellerId === me.data?.id;

  // Offers attached to the thread's messages (each offer is posted as a card).
  const offers = (messages.data ?? [])
    .map((m) => m.offer)
    .filter((o): o is Offer => !!o);
  const pendingOffers = offers.filter((o) => o.status === "pending");
  const lastPending = pendingOffers[pendingOffers.length - 1];
  // A seller can counter only when there's a pending offer from the buyer
  // (i.e. an offer the seller still needs to respond to). Once an offer has
  // been accepted or declined there is no pending offer, so the button hides.
  const sellerCanCounter = !!lastPending && lastPending.createdById !== me.data?.id;

  return (
    <div className="mx-auto flex h-[calc(100dvh-10.5rem)] max-w-5xl gap-0 px-0 md:h-[calc(100dvh-4rem)] md:px-4 md:pt-5">
      {/* Thread list */}
      <div className={`w-full overflow-y-auto border-r border-border md:w-72 ${id ? "hidden md:block" : "block"}`}>
        <div className="px-4 py-4 md:px-0">
          <h1 className="font-serif text-xl font-700 md:px-4">Inbox</h1>
        </div>
        {threads.isLoading ? (
          <div className="space-y-2 px-4 md:px-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : (threads.data?.length ?? 0) > 0 ? (
          <ul>
            {threads.data!.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/inbox/${t.id}`}
                  className={`flex items-center gap-3 px-4 py-3 transition hover:bg-muted ${
                    id === t.id ? "bg-muted" : ""
                  }`}
                >
                  <Avatar name={t.other?.displayName ?? "?"} color={t.other?.avatarColor ?? "#999"} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-600 text-sm">{t.other?.displayName}</p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {t.lastMessage ? formatMessageTime(t.lastMessage.createdAt) : ""}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.lastMessage?.text ?? "Start the conversation"}
                    </p>
                    {t.listing && (
                      <p className="mt-0.5 truncate text-[11px] text-primary">
                        {t.listing.title} · {formatPrice(t.listing.price)}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-6 py-16 text-center">
            <MessageCircle size={28} className="mx-auto text-muted-foreground/40" />
            <p className="mt-3 font-serif text-base font-600">No messages yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Message a seller from any listing to start a chat.
            </p>
          </div>
        )}
      </div>

      {/* Conversation */}
      <div className={`flex-1 flex-col md:flex ${id ? "flex" : "hidden md:flex"}`}>
        {id != null && thread.data ? (
          <>
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Link href="/inbox" className="md:hidden">
                <ArrowLeft size={20} />
              </Link>
              <Avatar
                name={thread.data.other?.displayName ?? "?"}
                color={thread.data.other?.avatarColor ?? "#999"}
                size={36}
              />
              <div className="min-w-0 flex-1">
                <p className="font-600 text-sm">{thread.data.other?.displayName}</p>
                {thread.data.listing && (
                  <Link
                    href={`/listing/${thread.data.listing.id}`}
                    className="truncate text-xs text-primary hover:underline"
                  >
                    {thread.data.listing.title} · {formatPrice(thread.data.listing.price)}
                  </Link>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-muted/30 px-4 py-4">
              <div className="space-y-2">
                {messages.data?.map((m) => {
                  const mine = m.senderId === me.data?.id;
                  if (m.offer) {
                    return (
                      <OfferCard
                        key={m.id}
                        offer={m.offer}
                        mine={mine}
                        currentUserId={me.data?.id}
                        listingId={thread.data?.listing?.id}
                        listingPrice={thread.data?.listing?.price}
                        isSeller={isSeller}
                        responding={respondOffer.isPending}
                        onRespond={(accept) =>
                          respondOffer.mutate({ offerId: m.offer!.id, accept })
                        }
                        onComplete={() =>
                          navigate(`/checkout/${thread.data?.listing?.id}`)
                        }
                        time={m.createdAt}
                      />
                    );
                  }
                  // The seller's acceptance posts a system message telling the
                  // buyer to complete checkout — surface a checkout link in that
                  // message too (for the buyer, while the listing is still reserved).
                  const acceptedCheckout =
                    !isSeller &&
                    thread.data?.listing?.status === "reserved" &&
                    m.text.startsWith("Offer accepted — awaiting payment");
                  return (
                    <div key={m.id} className={`group flex items-center gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                          mine
                            ? "rounded-br-sm bg-primary text-primary-foreground"
                            : "rounded-bl-sm bg-card border border-border"
                        }`}
                      >
                        <p>{m.text}</p>
                        {acceptedCheckout && (
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/checkout/${thread.data?.listing?.id}`)
                            }
                            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-600 text-background transition hover:bg-foreground/90"
                          >
                            <ShoppingBag size={13} /> Pay now
                          </button>
                        )}
                        <p className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                          {formatMessageTime(m.createdAt)}
                        </p>
                      </div>
                      {mine && (
                        <button
                          type="button"
                          disabled={deleteMessage.isPending}
                          onClick={() => deleteMessage.mutate(m.id)}
                          className="text-muted-foreground/0 transition hover:text-destructive group-hover:text-muted-foreground disabled:opacity-50"
                          aria-label="Delete message"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
                {sendMessage.isPending && (
                  <div className="flex justify-end">
                    <div className="rounded-2xl rounded-br-sm bg-primary/80 px-3.5 py-2 text-sm text-primary-foreground">
                      Sending…
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>
            </div>

            <div className="border-t border-border bg-background p-3">
              {/* Make / counter offer — labeled pill above the input so it's clearly visible on mobile.
                  Sellers only see "Counter offer" when there's a pending offer from the buyer to respond to. */}
              {listingAvailable && !offerOpen && (!isSeller || sellerCanCounter) && (
                <button
                  type="button"
                  onClick={() => setOfferOpen(true)}
                  className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-600 text-primary transition hover:bg-primary/10"
                >
                  <Tag size={13} />
                  {isSeller ? "Counter offer" : "Make offer"}
                </button>
              )}
              {/* Offer price input (shown when making/countering an offer) */}
              {offerOpen && listingAvailable && (
                <form
                  onSubmit={submitOffer}
                  className="mb-2 flex items-center gap-2 rounded-full border border-primary/40 bg-primary/5 py-1.5 pl-3 pr-1.5"
                >
                  <Tag size={14} className="text-primary" />
                  <span className="text-xs font-600 text-muted-foreground">{isSeller ? "Counter" : "Offer"}</span>
                  <span className="text-sm text-muted-foreground">£</span>
                  <input
                    autoFocus
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={offerPrice}
                    onChange={(e) => setOfferPrice(e.target.value)}
                    placeholder={String(thread.data?.listing?.price ?? "")}
                    className="w-20 bg-transparent text-sm outline-none"
                  />
                  <button
                    type="submit"
                    disabled={makeOffer.isPending || !offerPrice}
                    className="rounded-full bg-primary px-3 py-1.5 text-xs font-600 text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
                  >
                    {makeOffer.isPending ? "Sending…" : "Send offer"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setOfferOpen(false); setOfferPrice(""); }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </form>
              )}
              {/* Message composer — text input is the primary action */}
              <form onSubmit={submit} className="flex items-center gap-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type a message…"
                  className="flex-1 rounded-full border border-border bg-muted/50 px-4 py-2.5 text-sm outline-none focus:border-primary focus:bg-background"
                />
                <button
                  type="submit"
                  disabled={!text.trim() || sendMessage.isPending}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
                  aria-label="Send message"
                >
                  <Send size={17} />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="hidden flex-1 items-center justify-center md:flex">
            <div className="text-center">
              <MessageCircle size={32} className="mx-auto text-muted-foreground/40" />
              <p className="mt-3 font-serif text-base font-600">Select a conversation</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your messages with sellers will appear here.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const OFFER_STATUS_LABEL: Record<Offer["status"], string> = {
  pending: "Pending",
  accepted: "Awaiting payment",
  declined: "Declined",
  completed: "Sold",
  cancelled: "Cancelled",
};

function OfferCard({
  offer,
  mine,
  currentUserId,
  listingId,
  listingPrice,
  isSeller,
  responding,
  onRespond,
  onComplete,
  time,
}: {
  offer: Offer;
  mine: boolean;
  currentUserId?: number;
  listingId?: number;
  listingPrice?: number;
  isSeller: boolean;
  responding: boolean;
  onRespond: (accept: boolean) => void;
  onComplete: () => void;
  time: string;
}) {
  const recipient = currentUserId !== offer.createdById;
  const canComplete = offer.status === "accepted" && !isSeller && !!listingId;
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[80%] rounded-2xl border border-primary/30 bg-primary/5 px-3.5 py-2.5 text-sm">
        <div className="flex items-center gap-1.5 text-foreground">
          <Tag size={14} className="text-primary" />
          <span className="font-600">Offer {formatPrice(offer.price)}</span>
          {listingPrice != null && offer.price < listingPrice && (
            <span className="text-xs text-muted-foreground line-through">
              {formatPrice(listingPrice)}
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-600 ${
              offer.status === "accepted"
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : offer.status === "declined" || offer.status === "cancelled"
                  ? "bg-muted text-muted-foreground"
                  : offer.status === "completed"
                    ? "bg-primary/15 text-primary"
                    : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
            }`}
          >
            {OFFER_STATUS_LABEL[offer.status]}
          </span>
          <span className="text-[10px] text-muted-foreground">{formatMessageTime(time)}</span>
        </div>

        {offer.status === "pending" && recipient && (
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={responding}
              onClick={() => onRespond(true)}
              className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-600 text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              <Check size={13} /> Accept
            </button>
            <button
              type="button"
              disabled={responding}
              onClick={() => onRespond(false)}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-600 transition hover:bg-muted disabled:opacity-50"
            >
              <X size={13} /> Decline
            </button>
          </div>
        )}

        {canComplete && (
          <button
            type="button"
            onClick={onComplete}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-600 text-primary-foreground transition hover:bg-primary/90"
          >
            <ShoppingBag size={13} /> Pay now
          </button>
        )}

        {offer.status === "accepted" && isSeller && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Awaiting payment from the buyer.
          </p>
        )}
        {offer.status === "pending" && !recipient && (
          <p className="mt-1 text-[11px] text-muted-foreground">Waiting for a response.</p>
        )}
      </div>
    </div>
  );
}
