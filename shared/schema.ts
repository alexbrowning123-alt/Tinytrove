import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import type * as z from "zod/mini";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  avatarColor: text("avatar_color").notNull(),
  location: text("location").notNull(),
  joinedAt: text("joined_at").notNull(),
  rating: real("rating").notNull(),
  reviews: integer("reviews").notNull(),
  bio: text("bio"),
  // Stripe Connect (Express) — set when a seller connects payouts.
  stripeAccountId: text("stripe_account_id"),
  stripeChargesEnabled: integer("stripe_charges_enabled").notNull().default(0),
  stripePayoutsEnabled: integer("stripe_payouts_enabled").notNull().default(0),
  stripeDetailsSubmitted: integer("stripe_details_submitted").notNull().default(0),
  stripeOnboardingComplete: integer("stripe_onboarding_complete").notNull().default(0),
});

export const listings = sqliteTable("listings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  price: real("price").notNull(),
  category: text("category").notNull(),
  ageRange: text("age_range").notNull(),
  size: text("size"),
  condition: text("condition").notNull(),
  brand: text("brand").notNull(),
  location: text("location").notNull(),
  images: text("images").notNull(), // JSON array of image URLs
  sellerId: integer("seller_id").notNull(),
  status: text("status").notNull().default("available"), // available | reserved | sold
  createdAt: text("created_at").notNull(),
});

export const favorites = sqliteTable("favorites", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  listingId: integer("listing_id").notNull(),
});

export const threads = sqliteTable("threads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  listingId: integer("listing_id").notNull(),
  buyerId: integer("buyer_id").notNull(),
  sellerId: integer("seller_id").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  threadId: integer("thread_id").notNull(),
  senderId: integer("sender_id").notNull(),
  text: text("text").notNull(),
  offerId: integer("offer_id"), // nullable: links to an offer row when this message is an offer card
  createdAt: text("created_at").notNull(),
});

// A price offer made within a thread about a listing. Either party can make
// or counter an offer; the other participant accepts or declines. Accepting
// reserves the listing at the offered price until the buyer completes checkout.
export const offers = sqliteTable("offers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  threadId: integer("thread_id").notNull(),
  listingId: integer("listing_id").notNull(),
  buyerId: integer("buyer_id").notNull(), // the party who will buy (thread buyer)
  sellerId: integer("seller_id").notNull(), // the listing owner (thread seller)
  createdById: integer("created_by_id").notNull(), // who made this offer (buyer or seller)
  price: real("price").notNull(),
  status: text("status").notNull().default("pending"), // pending | accepted | declined | completed | cancelled
  orderId: integer("order_id"), // set when the accepted offer becomes an order
  createdAt: text("created_at").notNull(),
  respondedAt: text("responded_at"),
});

// Items a buyer has added to their cart (per user, server-side so it
// persists across devices/sessions and works with cookie auth).
export const cartItems = sqliteTable("cart_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  listingId: integer("listing_id").notNull(),
  addedAt: text("added_at").notNull(),
});

// A completed (simulated) purchase. No real payment is processed — the
// order exists to record what was bought, the delivery address, and to mark
// the underlying listings as sold.
export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  buyerId: integer("buyer_id").notNull(),
  status: text("status").notNull().default("completed"), // completed | cancelled
  total: real("total").notNull(),
  deliveryName: text("delivery_name").notNull(),
  deliveryAddress1: text("delivery_address_1").notNull(),
  deliveryAddress2: text("delivery_address_2"),
  deliveryCity: text("delivery_city").notNull(),
  deliveryPostcode: text("delivery_postcode").notNull(),
  contactEmail: text("contact_email").notNull(),
  createdAt: text("created_at").notNull(),
});

// Snapshot of each purchased item at the time of sale (price/title/seller
// are denormalised so an order's history is stable even if a listing is
// later deleted).
export const orderItems = sqliteTable("order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").notNull(),
  listingId: integer("listing_id").notNull(),
  title: text("title").notNull(),
  price: real("price").notNull(),
  sellerId: integer("seller_id").notNull(),
  sellerName: text("seller_name").notNull(),
  image: text("image"),
});

// Tracks a Stripe Checkout Session so webhook retries can't create duplicate
// orders. The session id is unique; finalization is idempotent on it.
export const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  stripeCheckoutSessionId: text("stripe_checkout_session_id").notNull().unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  listingId: integer("listing_id").notNull(),
  offerId: integer("offer_id"),
  buyerId: integer("buyer_id").notNull(),
  sellerId: integer("seller_id").notNull(),
  amountPence: integer("amount_pence").notNull(),
  applicationFeePence: integer("application_fee_pence").notNull().default(0),
  currency: text("currency").notNull().default("gbp"),
  status: text("status").notNull().default("pending"), // pending | paid | failed
  orderId: integer("order_id"),
  createdAt: text("created_at").notNull(),
  completedAt: text("completed_at"),
});

// Insert schemas
export const insertListingSchema = createInsertSchema(listings).omit({
  id: true,
  createdAt: true,
  status: true,
  sellerId: true,
});

export const insertFavoriteSchema = createInsertSchema(favorites).omit({
  id: true,
});

export const insertThreadSchema = createInsertSchema(threads).omit({
  id: true,
  updatedAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export type InsertListing = z.infer<typeof insertListingSchema>;
export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;
export type InsertThread = z.infer<typeof insertThreadSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type User = typeof users.$inferSelect;

/** Safe to send to the client — never includes passwordHash. */
export type PublicUser = Omit<User, "passwordHash">;
export type Listing = typeof listings.$inferSelect;
export type Favorite = typeof favorites.$inferSelect;
export type Thread = typeof threads.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Offer = typeof offers.$inferSelect;
export type CartItem = typeof cartItems.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;

// Auth is session-based (signed JWT in a __Host- cookie). There is no
// fixed "current user" — the authenticated user is resolved per request.

export const CATEGORIES = [
  "Clothing",
  "Shoes",
  "Toys & Play",
  "Prams & Pushchairs",
  "Nursery",
  "Feeding",
  "Books",
  "Carriers",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CONDITIONS = ["New with tags", "New without tags", "Very good", "Good", "Played with"] as const;
export type Condition = (typeof CONDITIONS)[number];

export const AGE_RANGES = [
  "Newborn",
  "0-3 months",
  "3-6 months",
  "6-9 months",
  "9-12 months",
  "1-2 years",
  "2-3 years",
  "3-4 years",
  "4-6 years",
  "6+ years",
] as const;
