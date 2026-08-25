import {
  users,
  listings,
  favorites,
  threads,
  messages,
  cartItems,
  orders,
  orderItems,
  offers,
  type User,
  type Listing,
  type Favorite,
  type Thread,
  type Message,
  type CartItem,
  type Order,
  type OrderItem,
  type Offer,
  type InsertListing,
  type InsertFavorite,
  type InsertThread,
  type InsertMessage,
  type PublicUser,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc, inArray, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import path from "node:path";
import fs from "node:fs";

// The database file lives in DATA_DIR when set (e.g. a Railway persistent
// volume), otherwise in the project root for local development. Putting the file
// on a mounted volume is what makes accounts and listings survive server
// restarts and redeploys.
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : process.cwd();
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = path.join(DATA_DIR, process.env.DB_FILE || "data.db");

const sqlite = new Database(DB_FILE);
sqlite.pragma("journal_mode = WAL");

// Idempotent startup migration: ensure the newer tables exist on databases
// that were created before they were added (e.g. an already-published live
// DB). CREATE TABLE IF NOT EXISTS is safe to run on every boot.
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    avatar_color TEXT NOT NULL,
    location TEXT NOT NULL,
    joined_at TEXT NOT NULL,
    rating REAL NOT NULL,
    reviews INTEGER NOT NULL,
    bio TEXT
  );
  CREATE TABLE IF NOT EXISTS listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    price REAL NOT NULL,
    category TEXT NOT NULL,
    age_range TEXT NOT NULL,
    size TEXT,
    condition TEXT NOT NULL,
    brand TEXT NOT NULL,
    location TEXT NOT NULL,
    images TEXT NOT NULL,
    seller_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'available',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    listing_id INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER NOT NULL,
    buyer_id INTEGER NOT NULL,
    seller_id INTEGER NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    offer_id INTEGER,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS cart_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    listing_id INTEGER NOT NULL,
    added_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    buyer_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed',
    total REAL NOT NULL,
    delivery_name TEXT NOT NULL,
    delivery_address_1 TEXT NOT NULL,
    delivery_address_2 TEXT,
    delivery_city TEXT NOT NULL,
    delivery_postcode TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    listing_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    price REAL NOT NULL,
    seller_id INTEGER NOT NULL,
    seller_name TEXT NOT NULL,
    image TEXT
  );
  CREATE TABLE IF NOT EXISTS offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id INTEGER NOT NULL,
    listing_id INTEGER NOT NULL,
    buyer_id INTEGER NOT NULL,
    seller_id INTEGER NOT NULL,
    created_by_id INTEGER NOT NULL,
    price REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    order_id INTEGER,
    created_at TEXT NOT NULL,
    responded_at TEXT
  );
`);

// Add the offer_id column to messages on older DBs that lack it.
const msgCols = sqlite.pragma("table_info(messages)") as Array<{ name: string }>;
if (!msgCols.some((c) => c.name === "offer_id")) {
  sqlite.exec("ALTER TABLE messages ADD COLUMN offer_id INTEGER");
}

export const db = drizzle(sqlite);

// Shared demo password so the seeded accounts are explorable.
const DEMO_PASSWORD_HASH = bcrypt.hashSync("tinytrove123", 10);

const AVATAR_COLORS = ["#e8a06a", "#7ec4b6", "#c89ad4", "#f4b6a3", "#9ec3e0", "#f2c94c", "#8ab0e6", "#e0a3b4"];
export function pickAvatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// Format a GBP amount for human-readable messages stored in the DB.
function fmtPrice(price: number): string {
  return `£${price.toFixed(2)}`;
}

// ---------- Seed data ----------

const seedUsers: Array<Omit<User, "id">> = [
  { username: "demo", email: "demo@tinytrove.app", passwordHash: DEMO_PASSWORD_HASH, displayName: "Alex (demo)", avatarColor: "#e8a06a", location: "Costessey, Norfolk", joinedAt: "2024-03-12", rating: 4.9, reviews: 12, bio: "Mum of two, selling the outgrown bits to fund the next size up." },
  { username: "emmaw", email: "emma@tinytrove.app", passwordHash: DEMO_PASSWORD_HASH, displayName: "Emma W.", avatarColor: "#7ec4b6", location: "Norwich, Norfolk", joinedAt: "2023-11-02", rating: 4.8, reviews: 47, bio: "Decluttering before a house move. Smoke-free, pet-free home." },
  { username: "sarahj", email: "sarah@tinytrove.app", passwordHash: DEMO_PASSWORD_HASH, displayName: "Sarah J.", avatarColor: "#c89ad4", location: "Ipswich, Suffolk", joinedAt: "2024-01-20", rating: 5.0, reviews: 23, bio: "Mum to a busy toddler. Everything washed before posting." },
  { username: "niamh", email: "niamh@tinytrove.app", passwordHash: DEMO_PASSWORD_HASH, displayName: "Niamh O.", avatarColor: "#f4b6a3", location: "Cambridge, Cambridgeshire", joinedAt: "2023-06-08", rating: 4.7, reviews: 61, bio: "Three kids, lots of lovely things outgrown far too quickly." },
  { username: "rachelb", email: "rachel@tinytrove.app", passwordHash: DEMO_PASSWORD_HASH, displayName: "Rachel B.", avatarColor: "#9ec3e0", location: "Colchester, Essex", joinedAt: "2024-05-15", rating: 4.9, reviews: 8, bio: "Sharing well-loved pieces and nursery bits." },
];

const IMG = {
  onesieSet: "https://d2u1z1lopyfwlx.cloudfront.net/thumbnails/818c9fd2-21af-5e20-af84-b9965b41c51a/e0768043-f16d-5667-a3cd-c51a212d68ac.jpg",
  whiteOnesie: "https://d2u1z1lopyfwlx.cloudfront.net/thumbnails/ff0163fb-ee5d-5c1b-b69c-8bb20f7e103c/e0768043-f16d-5667-a3cd-c51a212d68ac.jpg",
  pramBeige: "https://d2u1z1lopyfwlx.cloudfront.net/thumbnails/b87c3d1b-4b9c-5322-9cfd-8de77b4c1f7d/19fff8e5-c8d2-5bcc-b34c-43e2ef28b80a.jpg",
  pramPink: "https://d2u1z1lopyfwlx.cloudfront.net/thumbnails/e893615e-a8d9-5e89-9d34-5ab88fbe3dd5/19fff8e5-c8d2-5bcc-b34c-43e2ef28b80a.jpg",
  pramBlack: "https://d2u1z1lopyfwlx.cloudfront.net/thumbnails/5d740ccf-dd76-53a6-a6bc-b24d1fec4964/3e8cf789-6124-5215-bbd5-ca04762847e5.jpg",
  rattleSet: "https://d2u1z1lopyfwlx.cloudfront.net/thumbnails/531e154b-e9bb-58b9-8735-4d92128ce389/19fff8e5-c8d2-5bcc-b34c-43e2ef28b80a.jpg",
  woodenToys: "https://d2u1z1lopyfwlx.cloudfront.net/thumbnails/11b46137-2213-5002-9a65-58c3efbdce9d/19fff8e5-c8d2-5bcc-b34c-43e2ef28b80a.jpg",
  babyGym: "https://d2u1z1lopyfwlx.cloudfront.net/thumbnails/826661cf-c9b6-56d8-a4d6-d3b1e6e4436d/7f83bab0-f3d8-5f39-9612-8b851b7563ed.jpg",
  shoesNavy: "https://d2u1z1lopyfwlx.cloudfront.net/thumbnails/9dda3b27-b72b-5031-8e0a-861a74826f52/19fff8e5-c8d2-5bcc-b34c-43e2ef28b80a.jpg",
  shoesOat: "https://d2u1z1lopyfwlx.cloudfront.net/thumbnails/06d582fa-dfec-5c39-a383-e531c868e08c/6e0ad4a2-67e1-5345-856c-2715718ae5dd.jpg",
  bookshelf: "https://d2u1z1lopyfwlx.cloudfront.net/thumbnails/d57f6752-84b2-5bb7-a098-0caa9503b580/c5f9f3f3-30cc-59d4-a0ac-9021df7c2806.jpg",
  nurseryShelf: "https://d2u1z1lopyfwlx.cloudfront.net/thumbnails/9c8d0543-e90d-5934-9777-fedaa9467416/19fff8e5-c8d2-5bcc-b34c-43e2ef28b80a.jpg",
  highChairWood: "https://d2u1z1lopyfwlx.cloudfront.net/thumbnails/30b539f1-e070-5b44-8916-6452da90af7d/19fff8e5-c8d2-5bcc-b34c-43e2ef28b80a.jpg",
  highChairGrey: "https://d2u1z1lopyfwlx.cloudfront.net/thumbnails/96ac2c06-5de6-5595-b787-620c8a6d0690/78b7eb7a-896e-57ff-b047-c69590dd28e7.jpg",
  carrierSage: "https://d2u1z1lopyfwlx.cloudfront.net/thumbnails/220b00c5-9577-5311-b73a-73560c342348/949b23ec-f599-5fdc-a86a-e7b7681036c8.jpg",
  carrierBeige: "https://d2u1z1lopyfwlx.cloudfront.net/thumbnails/6a774d65-eb78-574e-afb4-09700eed4755/19fff8e5-c8d2-5bcc-b34c-43e2ef28b80a.jpg",
};

const seedListings: Array<Omit<Listing, "id" | "createdAt" | "status">> = [
  { title: "Bundle of 5 newborn vests", description: "Soft cotton vests, barely worn. From a smoke-free, pet-free home. Lovely neutral tones.", price: 8.5, category: "Clothing", ageRange: "Newborn", size: "0-3m", condition: "Very good", brand: "Next", location: "Norwich, Norfolk", images: JSON.stringify([IMG.onesieSet, IMG.whiteOnesie]), sellerId: 2 },
  { title: "John Lewis pram, beige", description: "Lightly used travel pram in a gorgeous warm beige. Folds flat, large basket. Moving to a buggy board so sadly outgrown.", price: 120, category: "Prams & Pushchairs", ageRange: "0-6 months", size: "From birth", condition: "Very good", brand: "John Lewis", location: "Ipswich, Suffolk", images: JSON.stringify([IMG.pramBeige, IMG.pramBlack]), sellerId: 3 },
  { title: "Pink umbrella pushchair", description: "Lightweight stroller, ideal for the car boot. One small mark on the handle as shown.", price: 22, category: "Prams & Pushchairs", ageRange: "6+ months", size: "6m+", condition: "Good", brand: "Cosatto", location: "Colchester, Essex", images: JSON.stringify([IMG.pramPink]), sellerId: 5 },
  { title: "Wooden rattle & teether set", description: "Natural wood Montessori set, beautifully smooth. Loved by my little one.", price: 14, category: "Toys & Play", ageRange: "6-9 months", size: "-", condition: "Very good", brand: "Hape", location: "Cambridge, Cambridgeshire", images: JSON.stringify([IMG.rattleSet, IMG.woodenToys]), sellerId: 4 },
  { title: "Baby play gym, wooden", description: "Sturdy wooden arch with hanging crochet toys. Folds for storage. A few months of use only.", price: 28, category: "Toys & Play", ageRange: "0-6 months", size: "-", condition: "Very good", brand: "Avenlur", location: "Cambridge, Cambridgeshire", images: JSON.stringify([IMG.babyGym]), sellerId: 4 },
  { title: "First walker trainers, navy", description: "Soft-soled barefoot shoes, barely scuffed. Perfect for those wobbly first steps.", price: 9, category: "Shoes", ageRange: "1-2 years", size: "5", condition: "Good", brand: "Ten Little", location: "Ipswich, Suffolk", images: JSON.stringify([IMG.shoesNavy]), sellerId: 3 },
  { title: "Leather first shoes, oat", description: "Gorgeous neutral first walkers, worn a handful of times before outgrown.", price: 11, category: "Shoes", ageRange: "1-2 years", size: "4", condition: "Very good", brand: "STQ", location: "Norwich, Norfolk", images: JSON.stringify([IMG.shoesOat]), sellerId: 2 },
  { title: "Front-facing bookshelf", description: "Montessori-style bookshelf so little ones can choose their own books. Solid pine.", price: 35, category: "Nursery", ageRange: "All ages", size: "-", condition: "Very good", brand: "JoyKids", location: "Colchester, Essex", images: JSON.stringify([IMG.bookshelf, IMG.nurseryShelf]), sellerId: 5 },
  { title: "Convertible wooden high chair", description: "Grows from high chair to toddler seat. Removable tray and harness included.", price: 42, category: "Feeding", ageRange: "6+ months", size: "-", condition: "Good", brand: "VEVOR", location: "Norwich, Norfolk", images: JSON.stringify([IMG.highChairWood, IMG.highChairGrey]), sellerId: 2 },
  { title: "Ergonomic baby carrier, sage", description: "Comfy structured carrier, newborn to toddler. Machine washable and in lovely condition.", price: 38, category: "Carriers", ageRange: "0-2 years", size: "-", condition: "Very good", brand: "Rebel", location: "Cambridge, Cambridgeshire", images: JSON.stringify([IMG.carrierSage, IMG.carrierBeige]), sellerId: 4 },
  { title: "Ring sling, beige", description: "Soft woven ring sling, gently used. Comes with original instruction card.", price: 18, category: "Carriers", ageRange: "0-2 years", size: "-", condition: "Good", brand: "TAB", location: "Ipswich, Suffolk", images: JSON.stringify([IMG.carrierBeige]), sellerId: 3 },
  { title: "Bundle of 3 board books", description: "Much-loved lift-the-flap books in great nick. Perfect for bedtime.", price: 5, category: "Books", ageRange: "1-3 years", size: "-", condition: "Good", brand: "Various", location: "Norwich, Norfolk", images: JSON.stringify([IMG.nurseryShelf]), sellerId: 2 },
];

function nowISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString();
}

export interface IStorage {
  // users + auth
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(input: { email: string; passwordHash: string; displayName: string; location: string; username: string; avatarColor: string; }): Promise<User>;
  // listings
  getListings(filters?: ListFilters): Promise<(Listing & { seller?: PublicUser })[]>;
  getListing(id: number): Promise<(Listing & { seller?: PublicUser }) | undefined>;
  getListingsBySeller(sellerId: number): Promise<Listing[]>;
  createListing(data: InsertListing): Promise<Listing>;
  updateListing(id: number, ownerId: number, data: Partial<InsertListing>): Promise<Listing | undefined>;
  markSold(id: number): Promise<void>;
  relistListing(id: number, ownerId: number): Promise<void>;
  deleteListing(id: number): Promise<void>;
  // favorites
  getFavorites(userId: number): Promise<(Favorite & { listing?: Listing })[]>;
  isFavorited(userId: number, listingId: number): Promise<boolean>;
  toggleFavorite(userId: number, listingId: number): Promise<boolean>;
  // threads & messages
  getThreads(userId: number): Promise<(Thread & { listing?: Listing; other?: User; lastMessage?: Message })[]>;
  getThread(id: number): Promise<(Thread & { listing?: Listing }) | undefined>;
  getOrCreateThread(listingId: number, buyerId: number, sellerId: number): Promise<Thread>;
  getMessages(threadId: number): Promise<(Message & { offer?: Offer })[]>;
  sendMessage(threadId: number, senderId: number, text: string, offerId?: number): Promise<Message>;
  deleteThread(threadId: number): Promise<void>;
  deleteMessage(messageId: number, senderId: number): Promise<void>;
  // offers
  createOffer(threadId: number, createdById: number, price: number): Promise<Offer>;
  respondToOffer(offerId: number, actorId: number, accept: boolean): Promise<Offer>;
  getAcceptedOfferForBuyer(listingId: number, buyerId: number): Promise<Offer | undefined>;
  completeOffer(offerId: number, orderId: number): Promise<void>;
  cancelOfferForListing(listingId: number, actorId: number): Promise<void>;
  seedThread(listingId: number, buyerId: number, sellerId: number, messages: Array<{ senderId: number; text: string; offsetHours: number }>): Promise<void>;
  // cart
  getCart(userId: number): Promise<(CartItem & { listing?: Listing; seller?: PublicUser })[]>;
  addToCart(userId: number, listingId: number): Promise<CartItem>;
  removeFromCart(itemId: number, userId: number): Promise<void>;
  // orders (simulated checkout — no real payment)
  createOrder(buyerId: number, listingIds: number[], delivery: OrderDelivery, opts?: { priceOverrides?: Record<number, number>; allowReserved?: boolean }): Promise<Order & { items: OrderItem[] }>;
  getOrders(userId: number): Promise<(Order & { items: OrderItem[] })[]>;
  getOrder(orderId: number, buyerId: number): Promise<(Order & { items: OrderItem[] }) | undefined>;
  deleteOrder(orderId: number, buyerId: number): Promise<void>;
}

export interface ListFilters {
  q?: string;
  category?: string;
  ageRange?: string;
  condition?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
}

export interface OrderDelivery {
  deliveryName: string;
  deliveryAddress1: string;
  deliveryAddress2?: string;
  deliveryCity: string;
  deliveryPostcode: string;
  contactEmail: string;
}

/** Error thrown by cart/order operations. `code` maps to an HTTP status and
 *  a user-facing message; the route layer turns it into a JSON response. */
export class CartError extends Error {
  code: "not-found" | "own-listing" | "sold" | "empty";
  constructor(code: CartError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "CartError";
  }
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    return db.select().from(users).where(eq(users.id, id)).get();
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return db.select().from(users).where(eq(users.email, email.toLowerCase())).get();
  }

  async createUser(input: { email: string; passwordHash: string; displayName: string; location: string; username: string; avatarColor: string; }): Promise<User> {
    return db
      .insert(users)
      .values({
        email: input.email.toLowerCase(),
        passwordHash: input.passwordHash,
        displayName: input.displayName,
        location: input.location,
        username: input.username,
        avatarColor: input.avatarColor,
        joinedAt: new Date().toISOString().slice(0, 10),
        rating: 5.0,
        reviews: 0,
      })
      .returning()
      .get();
  }

  private parseImages(row: Listing | undefined): Listing | undefined {
    if (!row) return row;
    try {
      (row as any).imageList = JSON.parse(row.images);
    } catch {
      (row as any).imageList = [];
    }
    return row;
  }

  async getListings(filters: ListFilters = {}): Promise<(Listing & { seller?: PublicUser })[]> {
    let rows = db.select().from(listings).all();
    rows = rows.filter((l) => l.status !== "sold" || false); // keep all; sold hidden on feed
    let f = rows.filter((l) => l.status === "available");

    if (filters.q) {
      const q = filters.q.toLowerCase();
      f = f.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.brand.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q)
      );
    }
    if (filters.category && filters.category !== "All") {
      f = f.filter((l) => l.category === filters.category);
    }
    if (filters.ageRange && filters.ageRange !== "All") {
      f = f.filter((l) => l.ageRange === filters.ageRange);
    }
    if (filters.condition && filters.condition !== "All") {
      f = f.filter((l) => l.condition === filters.condition);
    }
    if (filters.minPrice != null) f = f.filter((l) => l.price >= filters.minPrice!);
    if (filters.maxPrice != null) f = f.filter((l) => l.price <= filters.maxPrice!);

    const sort = filters.sort || "newest";
    f.sort((a, b) => {
      if (sort === "price-asc") return a.price - b.price;
      if (sort === "price-desc") return b.price - a.price;
      // newest by createdAt desc
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return f.map((l) => {
      const parsed = this.parseImages({ ...l }) as Listing;
      const sellerRow = db.select().from(users).where(eq(users.id, l.sellerId)).get();
      return { ...parsed, seller: sellerRow ? this.toPublicUser(sellerRow) : undefined };
    });
  }

  async getListing(id: number): Promise<(Listing & { seller?: PublicUser }) | undefined> {
    const row = db.select().from(listings).where(eq(listings.id, id)).get();
    if (!row) return undefined;
    const parsed = this.parseImages({ ...row }) as Listing;
    const sellerRow = db.select().from(users).where(eq(users.id, row.sellerId)).get();
    return { ...parsed, seller: sellerRow ? this.toPublicUser(sellerRow) : undefined };
  }

  /** Strip passwordHash and email (never needed publicly) before returning a user. */
  private toPublicUser(user: User): PublicUser {
    const { passwordHash: _ph, email: _e, ...rest } = user;
    return rest;
  }

  async getListingsBySeller(sellerId: number): Promise<Listing[]> {
    const rows = db.select().from(listings).where(eq(listings.sellerId, sellerId)).all();
    return rows.map((r) => this.parseImages({ ...r }) as Listing);
  }

  async createListing(data: InsertListing): Promise<Listing> {
    return db
      .insert(listings)
      .values({ ...data, status: "available", createdAt: nowISO() })
      .returning()
      .get();
  }

  // Only the listing owner may edit their own listing. Updates just the
  // editable fields the seller is allowed to change (never sellerId/status).
  async updateListing(id: number, ownerId: number, data: Partial<InsertListing>): Promise<Listing | undefined> {
    const listing = db.select().from(listings).where(eq(listings.id, id)).get();
    if (!listing || listing.sellerId !== ownerId) return undefined;
    const patch: Partial<Listing> = {};
    const fields = ["title", "description", "price", "category", "ageRange", "size", "condition", "brand", "location", "images"];
    for (const f of fields) if (f in data && (data as Record<string, unknown>)[f] !== undefined) (patch as Record<string, unknown>)[f] = (data as Record<string, unknown>)[f];
    if (Object.keys(patch).length === 0) return listing;
    db.update(listings).set(patch).where(eq(listings.id, id)).run();
    return db.select().from(listings).where(eq(listings.id, id)).get();
  }

  async markSold(id: number): Promise<void> {
    db.update(listings).set({ status: "sold" }).where(eq(listings.id, id)).run();
  }

  // A seller can relist an item whose sale fell through, so it reappears in the
  // browse feed. Only the listing owner may relist their own listing.
  async relistListing(id: number, ownerId: number): Promise<void> {
    db.update(listings)
      .set({ status: "available" })
      .where(and(eq(listings.id, id), eq(listings.sellerId, ownerId)))
      .run();
  }

  async deleteListing(id: number): Promise<void> {
    db.delete(favorites).where(eq(favorites.listingId, id)).run();
    db.delete(messages).where(
      inArray(messages.threadId,
        db.select({ id: threads.id }).from(threads).where(eq(threads.listingId, id))
      )
    ).run();
    db.delete(threads).where(eq(threads.listingId, id)).run();
    db.delete(listings).where(eq(listings.id, id)).run();
  }

  // favorites
  async getFavorites(userId: number): Promise<(Favorite & { listing?: Listing })[]> {
    const rows = db.select().from(favorites).where(eq(favorites.userId, userId)).all();
    return rows.map((fav) => {
      const listing = db.select().from(listings).where(eq(listings.id, fav.listingId)).get();
      return { ...fav, listing: listing ? (this.parseImages({ ...listing }) as Listing) : undefined };
    });
  }

  async isFavorited(userId: number, listingId: number): Promise<boolean> {
    const row = db
      .select()
      .from(favorites)
      .where(eq(favorites.userId, userId))
      .all()
      .find((f) => f.listingId === listingId);
    return !!row;
  }

  async toggleFavorite(userId: number, listingId: number): Promise<boolean> {
    const existing = db
      .select()
      .from(favorites)
      .where(eq(favorites.userId, userId))
      .all()
      .find((f) => f.listingId === listingId);
    if (existing) {
      db.delete(favorites).where(eq(favorites.id, existing.id)).run();
      return false; // now not favorited
    }
    db.insert(favorites).values({ userId, listingId }).run();
    return true; // now favorited
  }

  // threads
  async getThreads(userId: number): Promise<(Thread & { listing?: Listing; other?: User; lastMessage?: Message })[]> {
    const rows = db.select().from(threads).all();
    const mine = rows.filter((t) => t.buyerId === userId || t.sellerId === userId);
    return mine
      .map((t) => {
        const otherId = t.buyerId === userId ? t.sellerId : t.buyerId;
        const listing = db.select().from(listings).where(eq(listings.id, t.listingId)).get();
        const other = db.select().from(users).where(eq(users.id, otherId)).get();
        const msgs = db.select().from(messages).where(eq(messages.threadId, t.id)).all();
        const lastMessage = msgs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        return {
          ...t,
          listing: listing ? (this.parseImages({ ...listing }) as Listing) : undefined,
          other,
          lastMessage,
        };
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getThread(id: number): Promise<(Thread & { listing?: Listing }) | undefined> {
    const t = db.select().from(threads).where(eq(threads.id, id)).get();
    if (!t) return undefined;
    const listing = db.select().from(listings).where(eq(listings.id, t.listingId)).get();
    return { ...t, listing: listing ? (this.parseImages({ ...listing }) as Listing) : undefined };
  }

  async getOrCreateThread(listingId: number, buyerId: number, sellerId: number): Promise<Thread> {
    const existing = db
      .select()
      .from(threads)
      .all()
      .find((t) => t.listingId === listingId && t.buyerId === buyerId && t.sellerId === sellerId);
    if (existing) return existing;
    const created = db
      .insert(threads)
      .values({ listingId, buyerId, sellerId, updatedAt: nowISO() })
      .returning()
      .get();
    return created;
  }

  async getMessages(threadId: number): Promise<(Message & { offer?: Offer })[]> {
    const msgs = db
      .select()
      .from(messages)
      .where(eq(messages.threadId, threadId))
      .all()
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return msgs.map((m) => {
      if (!m.offerId) return { ...m };
      const offer = db.select().from(offers).where(eq(offers.id, m.offerId)).get();
      return { ...m, offer: offer ?? undefined };
    });
  }

  async sendMessage(threadId: number, senderId: number, text: string, offerId?: number): Promise<Message> {
    const msg = db
      .insert(messages)
      .values({ threadId, senderId, text, offerId: offerId ?? null, createdAt: nowISO() })
      .returning()
      .get();
    db.update(threads).set({ updatedAt: nowISO() }).where(eq(threads.id, threadId)).run();
    return msg;
  }

  async deleteThread(threadId: number): Promise<void> {
    db.delete(messages).where(eq(messages.threadId, threadId)).run();
    db.delete(threads).where(eq(threads.id, threadId)).run();
  }

  // A participant can delete their own message in a conversation.
  async deleteMessage(messageId: number, senderId: number): Promise<void> {
    db.delete(messages)
      .where(and(eq(messages.id, messageId), eq(messages.senderId, senderId)))
      .run();
  }

  // ---------- Offers ----------

  async createOffer(threadId: number, createdById: number, price: number): Promise<Offer> {
    const thread = db.select().from(threads).where(eq(threads.id, threadId)).get();
    if (!thread) throw new Error("Conversation not found.");
    if (createdById !== thread.buyerId && createdById !== thread.sellerId) {
      throw new Error("You are not part of this conversation.");
    }
    const listing = db.select().from(listings).where(eq(listings.id, thread.listingId)).get();
    if (!listing) throw new Error("Listing not found.");
    if (listing.status !== "available") throw new Error("This item is no longer available to offer on.");
    if (!Number.isFinite(price) || price <= 0) throw new Error("Enter a valid offer amount.");
    // Either participant (buyer or seller) can make or counter an offer;
    // the other participant is the one who accepts or declines.

    return sqlite.transaction(() => {
      const offer = db
        .insert(offers)
        .values({
          threadId,
          listingId: thread.listingId,
          buyerId: thread.buyerId,
          sellerId: thread.sellerId,
          createdById,
          price,
          status: "pending",
          createdAt: nowISO(),
        })
        .returning()
        .get();
      // Post an offer card as a message from the offer's creator.
      db.insert(messages)
        .values({
          threadId,
          senderId: createdById,
          text: `Offered ${fmtPrice(price)}`,
          offerId: offer.id,
          createdAt: nowISO(),
        })
        .run();
      db.update(threads).set({ updatedAt: nowISO() }).where(eq(threads.id, threadId)).run();
      return offer;
    })();
  }

  async respondToOffer(offerId: number, actorId: number, accept: boolean): Promise<Offer> {
    return sqlite.transaction(() => {
      const offer = db.select().from(offers).where(eq(offers.id, offerId)).get();
      if (!offer) throw new Error("Offer not found.");
      if (offer.status !== "pending") throw new Error("This offer has already been responded to.");
      const thread = db.select().from(threads).where(eq(threads.id, offer.threadId)).get();
      if (!thread) throw new Error("Conversation not found.");
      // The actor must be the participant who did NOT create the offer — and
      // must genuinely be part of this conversation.
      if (actorId !== thread.buyerId && actorId !== thread.sellerId) {
        throw new Error("You are not part of this conversation.");
      }
      if (actorId === offer.createdById) throw new Error("You can\'t accept your own offer.");
      const listing = db.select().from(listings).where(eq(listings.id, offer.listingId)).get();
      if (!listing) throw new Error("Listing not found.");

      if (accept) {
        if (listing.status !== "available") throw new Error("This item is no longer available.");
        db.update(listings).set({ status: "reserved" }).where(eq(listings.id, listing.id)).run();
        db.update(offers)
          .set({ status: "accepted", respondedAt: nowISO() })
          .where(eq(offers.id, offer.id))
          .run();
        // Decline any other pending offers on the same listing.
        db.update(offers)
          .set({ status: "declined", respondedAt: nowISO() })
          .where(
            and(
              eq(offers.listingId, listing.id),
              eq(offers.status, "pending"),
            )
          )
          .run();
        db.insert(messages)
          .values({
            threadId: offer.threadId,
            senderId: actorId,
            text: `Offer accepted — complete checkout at ${fmtPrice(offer.price)}`,
            createdAt: nowISO(),
          })
          .run();
      } else {
        db.update(offers)
          .set({ status: "declined", respondedAt: nowISO() })
          .where(eq(offers.id, offer.id))
          .run();
        db.insert(messages)
          .values({
            threadId: offer.threadId,
            senderId: actorId,
            text: `Offer of ${fmtPrice(offer.price)} declined`,
            createdAt: nowISO(),
          })
          .run();
      }
      db.update(threads).set({ updatedAt: nowISO() }).where(eq(threads.id, offer.threadId)).run();
      return db.select().from(offers).where(eq(offers.id, offer.id)).get()!;
    })();
  }

  async getAcceptedOfferForBuyer(listingId: number, buyerId: number): Promise<Offer | undefined> {
    const rows = db
      .select()
      .from(offers)
      .where(and(eq(offers.listingId, listingId), eq(offers.status, "accepted")))
      .all();
    // The buyer who can complete checkout is the thread buyer on this listing.
    return rows.find((o) => o.buyerId === buyerId);
  }

  async completeOffer(offerId: number, orderId: number): Promise<void> {
    db.update(offers)
      .set({ status: "completed", orderId, respondedAt: nowISO() })
      .where(eq(offers.id, offerId))
      .run();
  }

  // A seller releases a reserved listing (e.g. the buyer abandoned checkout).
  // Cancels the accepted offer, returns the item to the feed, and posts a
  // message in every affected thread so the other party is informed.
  async cancelOfferForListing(listingId: number, actorId: number): Promise<void> {
    const listing = db.select().from(listings).where(eq(listings.id, listingId)).get();
    if (!listing) return;
    if (listing.sellerId !== actorId) return;
    if (listing.status !== "reserved") return;
    return sqlite.transaction(() => {
      db.update(listings).set({ status: "available" }).where(eq(listings.id, listingId)).run();
      const accepted = db
        .select()
        .from(offers)
        .where(and(eq(offers.listingId, listingId), eq(offers.status, "accepted")))
        .all();
      for (const o of accepted) {
        db.update(offers)
          .set({ status: "cancelled", respondedAt: nowISO() })
          .where(eq(offers.id, o.id))
          .run();
        db.insert(messages)
          .values({
            threadId: o.threadId,
            senderId: actorId,
            text: "Reservation cancelled — item is available again",
            createdAt: nowISO(),
          })
          .run();
        db.update(threads).set({ updatedAt: nowISO() }).where(eq(threads.id, o.threadId)).run();
      }
    })();
  }

  // ---------- Cart ----------

  async getCart(userId: number): Promise<(CartItem & { listing?: Listing; seller?: PublicUser })[]> {
    const rows = db.select().from(cartItems).where(eq(cartItems.userId, userId)).all();
    return rows.map((c) => {
      const listing = db.select().from(listings).where(eq(listings.id, c.listingId)).get();
      const parsed = listing ? (this.parseImages({ ...listing }) as Listing) : undefined;
      const sellerRow = parsed ? db.select().from(users).where(eq(users.id, parsed.sellerId)).get() : undefined;
      return {
        ...c,
        listing: parsed,
        seller: sellerRow ? this.toPublicUser(sellerRow) : undefined,
      };
    });
  }

  async addToCart(userId: number, listingId: number): Promise<CartItem> {
    const listing = db.select().from(listings).where(eq(listings.id, listingId)).get();
    if (!listing) throw new CartError("not-found", "This listing no longer exists.");
    if (listing.sellerId === userId) throw new CartError("own-listing", "You can\'t buy your own listing.");
    if (listing.status !== "available") throw new CartError("sold", "This item is no longer available.");
    const existing = db.select().from(cartItems).where(eq(cartItems.userId, userId)).all().find((c) => c.listingId === listingId);
    if (existing) return existing;
    return db.insert(cartItems).values({ userId, listingId, addedAt: nowISO() }).returning().get();
  }

  async removeFromCart(itemId: number, userId: number): Promise<void> {
    const row = db.select().from(cartItems).where(eq(cartItems.id, itemId)).get();
    if (!row || row.userId !== userId) return;
    db.delete(cartItems).where(eq(cartItems.id, itemId)).run();
  }

  // ---------- Orders (simulated checkout) ----------

  /** Atomic order creation: re-validate every item is still available and not
   *  the buyer\'s own, insert the order + snapshot items, mark listings sold,
   *  and clear those listings from EVERY cart (not just the buyer\'s). */
  async createOrder(
    buyerId: number,
    listingIds: number[],
    delivery: OrderDelivery,
    opts?: { priceOverrides?: Record<number, number>; allowReserved?: boolean }
  ): Promise<Order & { items: OrderItem[] }> {
    if (!listingIds.length) throw new CartError("empty", "Your cart is empty.");

    return sqlite.transaction(() => {
      // Re-read + validate every listing inside the transaction.
      const snapshots: Array<{ listing: Listing; seller: User; price: number }> = [];
      for (const id of listingIds) {
        const listing = db.select().from(listings).where(eq(listings.id, id)).get();
        if (!listing) throw new CartError("not-found", "One of the items is no longer available.");
        if (listing.sellerId === buyerId) throw new CartError("own-listing", "You can\'t buy your own listing.");
        // A reserved listing can only be checked out when an accepted offer was
        // resolved for this buyer (opts.allowReserved is set by the route).
        const ok = listing.status === "available" || (opts?.allowReserved && listing.status === "reserved");
        if (!ok) throw new CartError("sold", `"${listing.title}" is no longer available.`);
        const seller = db.select().from(users).where(eq(users.id, listing.sellerId)).get();
        if (!seller) throw new CartError("not-found", "Seller not found.");
        snapshots.push({ listing, seller, price: opts?.priceOverrides?.[id] ?? listing.price });
      }

      const total = snapshots.reduce((sum, s) => sum + s.price, 0);
      const order = db
        .insert(orders)
        .values({
          buyerId,
          total,
          status: "completed",
          ...delivery,
          createdAt: nowISO(),
        })
        .returning()
        .get();

      const items: OrderItem[] = snapshots.map((s) => {
        const firstImage = (() => {
          try { const arr = JSON.parse(s.listing.images); return Array.isArray(arr) && arr.length ? arr[0] : null; } catch { return null; }
        })();
        return db
          .insert(orderItems)
          .values({
            orderId: order.id,
            listingId: s.listing.id,
            title: s.listing.title,
            price: s.price,
            sellerId: s.seller.id,
            sellerName: s.seller.displayName,
            image: firstImage,
          })
          .returning()
          .get();
      });

      // Mark listings sold + remove from every cart that held them.
      for (const s of snapshots) {
        db.update(listings).set({ status: "sold" }).where(eq(listings.id, s.listing.id)).run();
        db.delete(cartItems).where(eq(cartItems.listingId, s.listing.id)).run();
      }

      return { ...order, items };
    })();
  }

  async getOrders(userId: number): Promise<(Order & { items: OrderItem[] })[]> {
    const rows = db.select().from(orders).where(eq(orders.buyerId, userId)).all();
    return rows
      .map((o) => ({
        ...o,
        items: db.select().from(orderItems).where(eq(orderItems.orderId, o.id)).all(),
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getOrder(orderId: number, buyerId: number): Promise<(Order & { items: OrderItem[] }) | undefined> {
    const order = db.select().from(orders).where(eq(orders.id, orderId)).get();
    if (!order || order.buyerId !== buyerId) return undefined;
    return { ...order, items: db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).all() };
  }

  // A buyer can cancel/remove their own order from history. The underlying
  // listings stay "sold" unless the seller separately relists them.
  async deleteOrder(orderId: number, buyerId: number): Promise<void> {
    const order = db.select().from(orders).where(eq(orders.id, orderId)).get();
    if (!order || order.buyerId !== buyerId) return;
    db.delete(orderItems).where(eq(orderItems.orderId, orderId)).run();
    db.delete(orders).where(eq(orders.id, orderId)).run();
  }

  async seedThread(
    listingId: number,
    buyerId: number,
    sellerId: number,
    msgs: Array<{ senderId: number; text: string; offsetHours: number }>
  ): Promise<void> {
    const thread = await this.getOrCreateThread(listingId, buyerId, sellerId);
    for (const m of msgs) {
      const d = new Date();
      d.setHours(d.getHours() - m.offsetHours);
      db.insert(messages).values({ threadId: thread.id, senderId: m.senderId, text: m.text, createdAt: d.toISOString() }).run();
    }
    db.update(threads).set({ updatedAt: nowISO() }).where(eq(threads.id, thread.id)).run();
  }

  seed(): void {
    const count = db.select().from(users).all().length;
    if (count > 0) return;

    // users
    const createdUsers: User[] = seedUsers.map((u) =>
      db.insert(users).values(u).returning().get()
    );

    // listings
    for (const l of seedListings) {
      db.insert(listings)
        .values({ ...l, status: "available", createdAt: nowISO(Math.floor(Math.random() * 14) + 1) })
        .run();
    }

    // one seeded conversation: buyer "demo" (id 1) enquiring about the John Lewis pram (listing 2, seller 3)
    const pramListing = db.select().from(listings).where(eq(listings.title, "John Lewis pram, beige")).get();
    if (pramListing) {
      this.seedThread(pramListing.id, createdUsers[0].id, createdUsers[2].id, [
        { senderId: 1, text: "Hi! Is the pram still available? Would you consider £100?", offsetHours: 26 },
        { senderId: 3, text: "Hi, yes it's available. I could do £110 and that includes the rain cover. Collection from Ipswich or can post.", offsetHours: 24 },
        { senderId: 1, text: "That works — could you post to Norwich?", offsetHours: 2 },
      ]);
      // demo user has saved the pram + the carrier
      db.insert(favorites).values({ userId: createdUsers[0].id, listingId: pramListing.id }).run();
      const carrierListing = db.select().from(listings).where(eq(listings.title, "Ergonomic baby carrier, sage")).get();
      if (carrierListing) {
        db.insert(favorites).values({ userId: createdUsers[0].id, listingId: carrierListing.id }).run();
      }
    }
  }
}

export const storage = new DatabaseStorage();
