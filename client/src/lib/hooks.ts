import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Listing, Favorite, Thread, Message, PublicUser, CartItem, Order, OrderItem, Offer } from "@shared/schema";

export function useListings(filters: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v) qs.set(k, v);
  });
  const key = `/api/listings?${qs.toString()}`;
  return useQuery<(Listing & { seller?: User })[]>({
    queryKey: [key],
    // Listing status changes as other users act; never serve stale feed data.
    staleTime: 0,
    queryFn: async () => {
      const res = await apiRequest("GET", key);
      return res.json();
    },
  });
}

export function useListing(id: number | string | null) {
  const key = `/api/listings/${id}`;
  return useQuery<(Listing & { seller?: User }) | null>({
    queryKey: [key],
    enabled: id != null,
    // Status (available/reserved/sold) can change via other users' actions;
    // always refetch when the detail page mounts.
    staleTime: 0,
    queryFn: async () => {
      if (id == null) return null;
      const res = await apiRequest("GET", key);
      return res.json();
    },
  });
}

// Invalidate every listing-related query (feed, detail, offer, seller list).
// Query keys are single strings like ["/api/listings/4"], so we match by prefix
// via a predicate rather than array-element partial matching.
function invalidateListings(qc: QueryClient) {
  qc.invalidateQueries({
    predicate: (query) => {
      const k = query.queryKey[0];
      return typeof k === "string" && k.startsWith("/api/listings");
    },
  });
}

export function useCreateListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/listings", data);
      return res.json();
    },
    onSuccess: () => {
      invalidateListings(qc);
      qc.invalidateQueries({ queryKey: ["/api/users"] });
    },
  });
}

export function useUpdateListing(id: number | string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("PATCH", `/api/listings/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      invalidateListings(qc);
      qc.invalidateQueries({ queryKey: [`/api/listings/${id}`] });
      qc.invalidateQueries({ queryKey: ["/api/users"] });
    },
  });
}

export function useMarkSold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/listings/${id}/sold`);
      return res.json();
    },
    onSuccess: () => {
      invalidateListings(qc);
      qc.invalidateQueries({ queryKey: ["/api/users"] });
    },
  });
}

export function useFavorites() {
  return useQuery<(Favorite & { listing?: Listing })[]>({
    queryKey: ["/api/favorites"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/favorites");
        return res.json();
      } catch (e) {
        if ((e as Error).message.startsWith("401")) return [];
        throw e;
      }
    },
  });
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (listingId: number) => {
      const res = await apiRequest("POST", `/api/favorites/${listingId}/toggle`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/favorites"] });
    },
  });
}

export function useThreads() {
  return useQuery<(Thread & { listing?: Listing; other?: User; lastMessage?: Message })[]>({
    queryKey: ["/api/threads"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/threads");
        return res.json();
      } catch (e) {
        if ((e as Error).message.startsWith("401")) return [];
        throw e;
      }
    },
  });
}

export function useThread(id: number | null) {
  return useQuery<(Thread & { listing?: Listing; other?: User }) | null>({
    queryKey: [`/api/threads/${id}`],
    enabled: id != null,
    queryFn: async () => {
      if (id == null) return null;
      try {
        const res = await apiRequest("GET", `/api/threads/${id}`);
        return res.json();
      } catch (e) {
        if ((e as Error).message.startsWith("401")) return null;
        throw e;
      }
    },
  });
}

export function useMessages(threadId: number | null) {
  return useQuery<(Message & { offer?: Offer })[]>({
    queryKey: [`/api/threads/${threadId}/messages`],
    enabled: threadId != null,
    refetchInterval: threadId != null ? 3000 : false,
    queryFn: async () => {
      if (threadId == null) return [];
      try {
        const res = await apiRequest("GET", `/api/threads/${threadId}/messages`);
        return res.json();
      } catch (e) {
        if ((e as Error).message.startsWith("401")) return [];
        throw e;
      }
    },
  });
}

// Vinted-style offer negotiation. A buyer can make an offer; the seller can
// accept or decline; either side can counter by making a new offer.
export function useMakeOffer(threadId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (price: number) => {
      const res = await apiRequest("POST", "/api/offers", { threadId, price });
      return res.json() as Promise<Offer>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/threads/${threadId}/messages`] });
      qc.invalidateQueries({ queryKey: ["/api/threads"] });
    },
  });
}

export function useRespondOffer(threadId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ offerId, accept }: { offerId: number; accept: boolean }) => {
      const res = await apiRequest(
        "PATCH",
        `/api/offers/${offerId}/${accept ? "accept" : "decline"}`,
      );
      return res.json() as Promise<Offer>;
    },
    onSuccess: (offer) => {
      qc.invalidateQueries({ queryKey: [`/api/threads/${offer.threadId}/messages`] });
      qc.invalidateQueries({ queryKey: ["/api/threads"] });
      // Accepting/declining changes the listing's status (reserved / available),
      // so invalidate the listing + feed + offer caches.
      invalidateListings(qc);
    },
  });
}

// The accepted offer (if any) for the current user on a listing — used by the
// checkout page to show the agreed price, and by listing detail for state.
export function useAcceptedOffer(listingId: number | null | undefined) {
  return useQuery<Offer | null>({
    queryKey: [`/api/listings/${listingId}/offer`],
    enabled: listingId != null,
    // Offer state is time-sensitive (accepted → completed); never serve a
    // stale cached value, always refetch when a page mounts.
    staleTime: 0,
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", `/api/listings/${listingId}/offer`);
        const data = await res.json();
        return data ?? null;
      } catch (e) {
        // Logged-out viewers hit 401; treat as "no offer" rather than erroring.
        if ((e as Error).message.startsWith("401")) return null;
        throw e;
      }
    },
  });
}

export function useStartThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { listingId: number; initialMessage?: string }) => {
      const res = await apiRequest("POST", "/api/threads", args);
      return res.json() as Promise<Thread>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/threads"] });
    },
  });
}

export function useSendMessage(threadId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (text: string) => {
      const res = await apiRequest("POST", `/api/threads/${threadId}/messages`, { text });
      return res.json() as Promise<Message>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/threads/${threadId}/messages`] });
      qc.invalidateQueries({ queryKey: ["/api/threads"] });
    },
  });
}

export function useMe() {
  return useQuery<PublicUser | null>({
    queryKey: ["/api/me"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/me");
      const data = await res.json();
      return data ?? null;
    },
  });
}

export function useSignup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; password: string; displayName: string; location?: string }) => {
      const res = await apiRequest("POST", "/api/auth/signup", input);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/me"] });
    },
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", input);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/me"] });
      qc.invalidateQueries({ queryKey: ["/api/favorites"] });
      qc.invalidateQueries({ queryKey: ["/api/threads"] });
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/logout");
      return res.json();
    },
    onSuccess: () => {
      qc.clear();
    },
  });
}

export function useSellerListings(sellerId: number | string) {
  return useQuery<Listing[]>({
    queryKey: [`/api/users/${sellerId}/listings`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/users/${sellerId}/listings`);
      return res.json();
    },
  });
}

export function useUser(id: number | string | null) {
  return useQuery<PublicUser | null>({
    queryKey: [`/api/users/${id}`],
    enabled: id != null,
    queryFn: async () => {
      if (id == null) return null;
      const res = await apiRequest("GET", `/api/users/${id}`);
      return res.json();
    },
  });
}

// ---------- Cart ----------

export function useCart() {
  return useQuery<(CartItem & { listing?: Listing })[]>({
    queryKey: ["/api/cart"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/cart");
        return res.json();
      } catch (e) {
        if ((e as Error).message.startsWith("401")) return [];
        throw e;
      }
    },
  });
}

export function useAddToCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (listingId: number) => {
      const res = await apiRequest("POST", `/api/cart/${listingId}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/cart"] });
    },
  });
}

export function useRemoveFromCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: number) => {
      await apiRequest("DELETE", `/api/cart/${itemId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/cart"] });
    },
  });
}

// ---------- Checkout & Orders (simulated — no real payment) ----------

export interface DeliveryDetails {
  deliveryName: string;
  deliveryAddress1: string;
  deliveryAddress2?: string;
  deliveryCity: string;
  deliveryPostcode: string;
  contactEmail: string;
}

export function useCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (delivery: DeliveryDetails) => {
      const res = await apiRequest("POST", "/api/checkout", delivery);
      return res.json() as Promise<Order & { items: OrderItem[] }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/cart"] });
      invalidateListings(qc);
      qc.invalidateQueries({ queryKey: ["/api/orders"] });
    },
  });
}

export function useBuyNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ listingId, delivery }: { listingId: number; delivery: DeliveryDetails }) => {
      const res = await apiRequest("POST", "/api/checkout/buy-now", { listingId, ...delivery });
      return res.json() as Promise<Order & { items: OrderItem[] }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/cart"] });
      invalidateListings(qc);
      qc.invalidateQueries({ queryKey: ["/api/orders"] });
    },
  });
}

export function useOrders() {
  return useQuery<(Order & { items: OrderItem[] })[]>({
    queryKey: ["/api/orders"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/orders");
        return res.json();
      } catch (e) {
        if ((e as Error).message.startsWith("401")) return [];
        throw e;
      }
    },
  });
}

export function useOrder(id: number | string | null) {
  return useQuery<(Order & { items: OrderItem[] }) | null>({
    queryKey: [`/api/orders/${id}`],
    enabled: id != null,
    queryFn: async () => {
      if (id == null) return null;
      try {
        const res = await apiRequest("GET", `/api/orders/${id}`);
        return res.json();
      } catch (e) {
        if ((e as Error).message.startsWith("401")) return null;
        throw e;
      }
    },
  });
}

// Cancel/remove your own order from history.
export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: number) => {
      const res = await apiRequest("DELETE", `/api/orders/${orderId}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/orders"] });
    },
  });
}

// A seller relists a sold item so it reappears in the browse feed.
export function useRelistListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/listings/${id}/relist`);
      return res.json();
    },
    onSuccess: () => {
      invalidateListings(qc);
    },
  });
}

// Delete your own message in a conversation.
export function useDeleteMessage(threadId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (messageId: number) => {
      const res = await apiRequest("DELETE", `/api/messages/${messageId}`);
      return res.json();
    },
    onSuccess: () => {
      if (threadId != null) {
        qc.invalidateQueries({ queryKey: [`/api/threads/${threadId}/messages`] });
      }
    },
  });
}

// --- Stripe Connect (real checkout) ---

export function useStripeConfig() {
  return useQuery<{ enabled: boolean }>({
    queryKey: ["/api/stripe/config"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/stripe/config");
      return res.json();
    },
  });
}

export interface StripeStatus {
  enabled: boolean;
  connected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  onboardingComplete: boolean;
}

export function useStripeStatus() {
  return useQuery<StripeStatus>({
    queryKey: ["/api/stripe/connect/status"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/stripe/connect/status");
      return res.json();
    },
  });
}

export function useStripeOnboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/stripe/connect/onboard");
      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: (data) => {
      // Redirect the seller into Stripe's hosted onboarding.
      if (data?.url) window.location.href = data.url;
      qc.invalidateQueries({ queryKey: ["/api/stripe/connect/status"] });
    },
  });
}

// Creates a Stripe Checkout Session for a single listing and redirects the
// buyer to Stripe's hosted payment page.
export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: async (listingId: number) => {
      const res = await apiRequest("POST", "/api/stripe/checkout-session", { listingId });
      return res.json() as Promise<{ url: string; sessionId: string }>;
    },
  });
}
