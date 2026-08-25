import express from "express";
import type { Request, Response, NextFunction, Express } from "express";
import type { Server } from "node:http";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import multer from "multer";
import { storage, type OrderDelivery, CartError } from "./storage";
import {
  isStripeConfigured,
  getStripe,
  createConnectAccount,
  createOnboardingLink,
  getAccountStatus,
  createCheckoutSession,
  toPence,
  platformFeeBps,
  computeFeePence,
  type StripeAccountStatus,
} from "./stripe";
import { insertListingSchema, type PublicUser, type User, type InsertListing } from "@shared/schema";

// ---------- Auth helpers ----------

const PROD = process.env.NODE_ENV === "production";
// A stable JWT secret must be supplied in production so sessions survive
// restarts. A random fallback would invalidate every logged-in user on each
// boot, so we fail fast instead of silently degrading.
const JWT_SECRET = process.env.JWT_SECRET || (PROD ? "" : crypto.randomBytes(32).toString("hex"));
if (!JWT_SECRET) {
  throw new Error(
    "JWT_SECRET environment variable is required in production. Generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
  );
}
const COOKIE_NAME = "__Host-sid";
const TOKEN_TTL = "30d";

// Lightweight per-IP rate limiter (in-memory, single-instance).
//
// IMPORTANT: we deliberately do NOT read `X-Forwarded-For` ourselves — that
// header is fully attacker-controlled unless a trusted reverse proxy
// overwrites it, and this app does not set `app.set("trust proxy", ...)`.
// Reading it directly would let any client bypass the limit by sending a
// different `X-Forwarded-For` value on every request. Instead we key on
// `req.ip` / `req.socket.remoteAddress`, which reflects the real TCP peer
// address and cannot be spoofed by the client. If this app is ever deployed
// behind a trusted reverse proxy/load balancer, configure `app.set("trust
// proxy", <trusted hop count or IP list>)` so Express itself derives `req.ip`
// safely from the proxy-supplied header — do not re-introduce a manual
// `X-Forwarded-For` read here.
const RATE_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_MAX = 20; // 20 requests per IP per minute
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
// Clean up expired buckets periodically.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateBuckets) if (v.resetAt < now) rateBuckets.delete(k);
}, 5 * 60 * 1000).unref();
function rateLimit(req: Request, res: Response, next: () => void) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
  } else {
    bucket.count++;
  }
  const b = rateBuckets.get(ip)!;
  if (b.count > RATE_MAX) {
    return res.status(429).json({ message: "Too many requests. Please wait a minute and try again." });
  }
  next();
}

function signToken(userId: number): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function setAuthCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: PROD,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

/** Strip passwordHash before sending to the client. */
function toPublicUser(user: User, includeEmail = false): PublicUser {
  const { passwordHash: _ph, ...rest } = user;
  const out: PublicUser = rest;
  if (!includeEmail) (out as any).email = undefined;
  return out;
}

// Augment Request with an optional `user`.
declare module "express-serve-static-core" {
  interface Request {
    user?: User;
  }
}

/** Reads the JWT from the cookie and attaches req.user. Public — never 401s. */
async function attachUser(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { sub: number };
      const user = await storage.getUser(payload.sub);
      if (user) req.user = user;
    } catch {
      /* invalid/expired token — treat as logged out */
    }
  }
  next();
}

/** Requires an authenticated user. Sends 401 if absent. */
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "Please log in to continue" });
  }
  next();
}

// ---------- Uploads ----------

// Uploaded listing images are written to UPLOAD_DIR when set (e.g. a Railway
// persistent volume), otherwise the local ./uploads folder. Mounting a volume
// here is what keeps uploaded photos across redeploys.
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().slice(0, 8);
      cb(null, `${crypto.randomBytes(8).toString("hex")}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB per image
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

export async function registerRoutes(
  _httpServer: Server,
  app: Express
): Promise<Server> {
  // cookie parsing (lightweight, no extra dep)
  app.use((req, _res, next) => {
    const header = req.headers.cookie;
    const cookies: Record<string, string> = {};
    if (header) {
      for (const part of header.split(";")) {
        const [k, ...v] = part.trim().split("=");
        if (k) cookies[decodeURIComponent(k)] = decodeURIComponent(v.join("="));
      }
    }
    (req as any).cookies = cookies;
    next();
  });

  app.use(attachUser);

  // Serve uploaded images (with long cache headers). Must precede the SPA catch-all.
  app.use(
    "/uploads",
    (_req, res, next) => {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      next();
    },
    express.static(UPLOAD_DIR)
  );

  // Seed on first boot
  storage.seed();

  // ---------- Auth ----------

  app.post("/api/auth/signup", rateLimit, async (req, res) => {
    const { email, password, displayName, location } = req.body as {
      email?: string;
      password?: string;
      displayName?: string;
      location?: string;
    };
    const e = (email || "").trim().toLowerCase();
    const name = (displayName || "").trim();
    const loc = (location || "United Kingdom").trim();
    if (!e || !/.+@.+\..+/.test(e)) return res.status(400).json({ message: "Please enter a valid email" });
    if (!name) return res.status(400).json({ message: "Please enter your name" });
    if (!password || password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });

    const existing = await storage.getUserByEmail(e);
    if (existing) return res.status(409).json({ message: "An account with that email already exists" });

    const passwordHash = bcrypt.hashSync(password, 10);
    const username = `${e.split("@")[0]}${crypto.randomBytes(2).toString("hex")}`;
    const user = await storage.createUser({
      email: e,
      passwordHash,
      displayName: name,
      location: loc,
      username,
      avatarColor: pickColorFromEmail(e),
    });
    setAuthCookie(res, signToken(user.id));
    res.status(201).json(toPublicUser(user, true));
  });

  app.post("/api/auth/login", rateLimit, async (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    const e = (email || "").trim().toLowerCase();
    const user = await storage.getUserByEmail(e);
    if (!user || !bcrypt.compareSync(password || "", user.passwordHash)) {
      return res.status(401).json({ message: "Incorrect email or password" });
    }
    setAuthCookie(res, signToken(user.id));
    res.json(toPublicUser(user, true));
  });

  app.post("/api/auth/logout", (_req, res) => {
    clearAuthCookie(res);
    res.json({ ok: true });
  });

  // ---------- Current user ----------

  app.get("/api/me", (req, res) => {
    if (!req.user) return res.status(200).json(null);
    res.json(toPublicUser(req.user, true));
  });

  // ---------- Listings ----------

  app.get("/api/listings", async (req, res) => {
    const { q, category, ageRange, condition, minPrice, maxPrice, sort } =
      req.query as Record<string, string | undefined>;
    res.json(
      await storage.getListings({
        q: q || undefined,
        category: category === "All" ? undefined : category,
        ageRange: ageRange === "All" ? undefined : ageRange,
        condition: condition === "All" ? undefined : condition,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        sort: sort || "newest",
      })
    );
  });

  app.get("/api/listings/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    const listing = await storage.getListing(id);
    if (!listing) return res.status(404).json({ message: "Not found" });
    res.json(listing);
  });

  app.post("/api/listings", requireAuth, async (req, res) => {
    const parsed = insertListingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid listing", errors: parsed.error.issues });
    }
    // Seller is always the logged-in user (never trust client-sent sellerId)
    const created = await storage.createListing({ ...parsed.data, sellerId: req.user!.id });
    res.status(201).json(created);
  });

  app.patch("/api/listings/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const listing = await storage.getListing(id);
    if (!listing) return res.status(404).json({ message: "Not found" });
    if (listing.sellerId !== req.user!.id) return res.status(403).json({ message: "Not your listing" });
    if (listing.status !== "available") return res.status(400).json({ message: "Only available listings can be edited — relist it first if sold" });
    const b = req.body as Record<string, unknown>;
    const priceNum = Number(b.price);
    const data: Partial<InsertListing> = {
      title: b.title != null ? String(b.title).trim() : undefined,
      description: b.description != null ? String(b.description).trim() : undefined,
      price: b.price != null && Number.isFinite(priceNum) && priceNum > 0 ? priceNum : undefined,
      category: b.category != null ? String(b.category) : undefined,
      ageRange: b.ageRange != null ? String(b.ageRange) : undefined,
      size: b.size != null ? String(b.size) : undefined,
      condition: b.condition != null ? String(b.condition) : undefined,
      brand: b.brand != null ? String(b.brand) : undefined,
      location: b.location != null ? String(b.location).trim() : undefined,
      images: b.images != null ? (typeof b.images === "string" ? b.images : JSON.stringify(b.images)) : undefined,
    };
    Object.keys(data).forEach((k) => (data as Record<string, unknown>)[k] === undefined && delete (data as Record<string, unknown>)[k]);
    if (Object.keys(data).length === 0) return res.status(400).json({ message: "No fields to update" });
    const updated = await storage.updateListing(id, req.user!.id, data);
    res.json(updated);
  });

  app.patch("/api/listings/:id/sold", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const listing = await storage.getListing(id);
    if (!listing) return res.status(404).json({ message: "Not found" });
    if (listing.sellerId !== req.user!.id) return res.status(403).json({ message: "Not your listing" });
    await storage.markSold(id);
    res.json({ ok: true });
  });

  app.patch("/api/listings/:id/relist", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const listing = await storage.getListing(id);
    if (!listing) return res.status(404).json({ message: "Not found" });
    if (listing.sellerId !== req.user!.id) return res.status(403).json({ message: "Not your listing" });
    // Sellers can relist a sold item OR release a reserved one (e.g. if the
    // buyer abandoned checkout after an accepted offer).
    if (listing.status === "sold") {
      await storage.relistListing(id, req.user!.id);
    } else if (listing.status === "reserved") {
      await storage.cancelOfferForListing(id, req.user!.id);
    } else {
      return res.status(400).json({ message: "Listing is not sold or reserved" });
    }
    res.json({ ok: true });
  });

  app.delete("/api/listings/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const listing = await storage.getListing(id);
    if (!listing) return res.status(404).json({ message: "Not found" });
    if (listing.sellerId !== req.user!.id) return res.status(403).json({ message: "Not your listing" });
    await storage.deleteListing(id);
    res.json({ ok: true });
  });

  // ---------- Image uploads ----------

  app.post("/api/uploads", rateLimit, requireAuth, upload.array("images", 6), (req, res) => {
    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length === 0) return res.status(400).json({ message: "No images uploaded" });
    const urls = files.map((f) => `/uploads/${f.filename}`);
    res.status(201).json({ urls });
  });

  // ---------- Favorites ----------

  app.get("/api/favorites", requireAuth, async (req, res) => {
    res.json(await storage.getFavorites(req.user!.id));
  });

  app.post("/api/favorites/:id/toggle", requireAuth, async (req, res) => {
    const listingId = Number(req.params.id);
    const favorited = await storage.toggleFavorite(req.user!.id, listingId);
    res.json({ favorited });
  });

  // ---------- Threads & Messages ----------

  app.get("/api/threads", requireAuth, async (req, res) => {
    res.json(await storage.getThreads(req.user!.id));
  });

  app.get("/api/threads/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const thread = await storage.getThread(id);
    if (!thread) return res.status(404).json({ message: "Not found" });
    if (thread.buyerId !== req.user!.id && thread.sellerId !== req.user!.id) {
      return res.status(403).json({ message: "Not part of this conversation" });
    }
    const otherId = thread.buyerId === req.user!.id ? thread.sellerId : thread.buyerId;
    const other = await storage.getUser(otherId);
    res.json({ ...thread, other: other ? toPublicUser(other) : undefined });
  });

  app.delete("/api/threads/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const thread = await storage.getThread(id);
    if (!thread) return res.status(404).json({ message: "Not found" });
    if (thread.buyerId !== req.user!.id && thread.sellerId !== req.user!.id) {
      return res.status(403).json({ message: "Not part of this conversation" });
    }
    await storage.deleteThread(id);
    res.json({ ok: true });
  });

  app.delete("/api/messages/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    await storage.deleteMessage(id, req.user!.id);
    res.json({ ok: true });
  });

  // ---------- Offers (Vinted-style negotiation) ----------

  app.post("/api/offers", requireAuth, async (req, res) => {
    const { threadId, price } = req.body as { threadId?: number; price?: number };
    const tid = Number(threadId);
    const amount = Number(price);
    if (!Number.isFinite(tid)) return res.status(400).json({ message: "Invalid thread id" });
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: "Enter a valid offer amount" });
    try {
      const offer = await storage.createOffer(tid, req.user!.id, amount);
      res.status(201).json(offer);
    } catch (e) {
      res.status(400).json({ message: (e as Error).message || "Could not make offer" });
    }
  });

  app.patch("/api/offers/:id/accept", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    try {
      // When real payments are enabled, the seller must have finished Stripe
      // Connect onboarding before they can accept an offer — otherwise the
      // buyer would hit a dead end at checkout.
      if (isStripeConfigured()) {
        const offer = await storage.getOfferById(id);
        if (!offer) return res.status(404).json({ message: "Offer not found" });
        if (offer.sellerId !== req.user!.id) {
          return res.status(403).json({ message: "Only the seller can accept this offer" });
        }
        const seller = await storage.getUser(offer.sellerId);
        if (!seller?.stripeAccountId) {
          return res.status(409).json({
            code: "seller-payouts-required",
            message: "Set up Stripe payouts before accepting offers.",
          });
        }
        const status = await getAccountStatus(seller.stripeAccountId);
        if (!status.chargesEnabled) {
          return res.status(409).json({
            code: "seller-payouts-required",
            message: "Finish Stripe payout setup before accepting offers.",
          });
        }
      }
      const offer = await storage.respondToOffer(id, req.user!.id, true);
      res.json(offer);
    } catch (e) {
      res.status(400).json({ message: (e as Error).message || "Could not accept offer" });
    }
  });

  app.patch("/api/offers/:id/decline", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    try {
      const offer = await storage.respondToOffer(id, req.user!.id, false);
      res.json(offer);
    } catch (e) {
      res.status(400).json({ message: (e as Error).message || "Could not decline offer" });
    }
  });

  // Lets the checkout page show the agreed price for an accepted offer.
  app.get("/api/listings/:id/offer", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const offer = await storage.getAcceptedOfferForBuyer(id, req.user!.id);
    res.json(offer ?? null);
  });

  app.get("/api/threads/:id/messages", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const thread = await storage.getThread(id);
    if (!thread) return res.status(404).json({ message: "Not found" });
    if (thread.buyerId !== req.user!.id && thread.sellerId !== req.user!.id) {
      return res.status(403).json({ message: "Not part of this conversation" });
    }
    res.json(await storage.getMessages(id));
  });

  app.post("/api/threads", requireAuth, async (req, res) => {
    const { listingId, initialMessage } = req.body as { listingId: number; initialMessage?: string };
    const listing = await storage.getListing(Number(listingId));
    if (!listing) return res.status(404).json({ message: "Listing not found" });
    if (listing.sellerId === req.user!.id) {
      return res.status(400).json({ message: "You can't message your own listing" });
    }
    const thread = await storage.getOrCreateThread(listingId, req.user!.id, listing.sellerId);
    if (initialMessage && initialMessage.trim()) {
      await storage.sendMessage(thread.id, req.user!.id, initialMessage.trim());
    }
    res.json(thread);
  });

  app.post("/api/threads/:id/messages", requireAuth, async (req, res) => {
    const threadId = Number(req.params.id);
    const { text } = req.body as { text: string };
    if (!text || !text.trim()) return res.status(400).json({ message: "Empty message" });

    const thread = await storage.getThread(threadId);
    if (!thread) return res.status(404).json({ message: "Not found" });
    if (thread.buyerId !== req.user!.id && thread.sellerId !== req.user!.id) {
      return res.status(403).json({ message: "Not part of this conversation" });
    }

    const msg = await storage.sendMessage(threadId, req.user!.id, text.trim());

    res.status(201).json(msg);
  });

  // ---------- Cart ----------

  app.get("/api/cart", requireAuth, async (req, res) => {
    res.json(await storage.getCart(req.user!.id));
  });

  app.post("/api/cart/:listingId", requireAuth, async (req, res) => {
    const listingId = Number(req.params.listingId);
    if (!Number.isFinite(listingId)) return res.status(400).json({ message: "Invalid listing id" });
    try {
      const item = await storage.addToCart(req.user!.id, listingId);
      res.status(201).json(item);
    } catch (e) {
      handleCartError(e, res);
    }
  });

  app.delete("/api/cart/:itemId", requireAuth, async (req, res) => {
    const itemId = Number(req.params.itemId);
    if (!Number.isFinite(itemId)) return res.status(400).json({ message: "Invalid id" });
    await storage.removeFromCart(itemId, req.user!.id);
    res.json({ ok: true });
  });

  // ---------- Checkout & Orders (simulated — no real payment) ----------

  app.post("/api/checkout", requireAuth, async (req, res) => {
    const delivery = parseDelivery(req.body);
    if ("status" in delivery) return res.status(delivery.status).json({ message: delivery.message });
    const cart = await storage.getCart(req.user!.id);
    const listingIds = cart.map((c) => c.listingId);
    try {
      const order = await storage.createOrder(req.user!.id, listingIds, delivery);
      res.status(201).json(order);
    } catch (e) {
      handleCartError(e, res);
    }
  });

  app.post("/api/checkout/buy-now", requireAuth, async (req, res) => {
    const { listingId } = req.body as { listingId?: number };
    const id = Number(listingId);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid listing id" });
    const delivery = parseDelivery(req.body);
    if ("status" in delivery) return res.status(delivery.status).json({ message: delivery.message });
    try {
      // If the buyer has an accepted offer on this listing, check it out at the
      // agreed price (the listing will be "reserved"). Server resolves the
      // price — the client never supplies it.
      const acceptedOffer = await storage.getAcceptedOfferForBuyer(id, req.user!.id);
      const order = await storage.createOrder(req.user!.id, [id], delivery, {
        priceOverrides: acceptedOffer ? { [id]: acceptedOffer.price } : undefined,
        allowReserved: !!acceptedOffer,
      });
      if (acceptedOffer) await storage.completeOffer(acceptedOffer.id, order.id);
      res.status(201).json(order);
    } catch (e) {
      handleCartError(e, res);
    }
  });

  app.get("/api/orders", requireAuth, async (req, res) => {
    res.json(await storage.getOrders(req.user!.id));
  });

  app.get("/api/orders/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const order = await storage.getOrder(id, req.user!.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  });

  app.delete("/api/orders/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    await storage.deleteOrder(id, req.user!.id);
    res.json({ ok: true });
  });

  // ---------- Public user / seller ----------

  app.get("/api/users/:id", async (req, res) => {
    const user = await storage.getUser(Number(req.params.id));
    if (!user) return res.status(404).json({ message: "Not found" });
    res.json(toPublicUser(user));
  });

  app.get("/api/users/:id/listings", async (req, res) => {
    res.json(await storage.getListingsBySeller(Number(req.params.id)));
  });

  // ---------- Stripe Connect (real checkout) ----------
  // Feature-gated: if STRIPE_SECRET_KEY is not set, these endpoints report
  // that Stripe isn't configured and the existing simulated checkout keeps
  // working unchanged.

  app.get("/api/stripe/config", (req, res) => {
    res.json({ enabled: isStripeConfigured() });
  });

  // Seller's current Stripe Connect status, with a fresh live lookup if an
  // account exists. Also returns whether payouts are required to accept offers.
  app.get("/api/stripe/connect/status", requireAuth, async (req, res) => {
    const user = await storage.getUser(req.user!.id);
    if (!user) return res.status(404).json({ message: "Not found" });
    if (!isStripeConfigured()) {
      return res.json({ enabled: false, connected: false, chargesEnabled: false, onboardingComplete: false });
    }
    if (!user.stripeAccountId) {
      return res.json({ enabled: true, connected: false, chargesEnabled: false, onboardingComplete: false });
    }
    let status: StripeAccountStatus;
    try {
      status = await getAccountStatus(user.stripeAccountId);
    } catch {
      return res.json({
        enabled: true,
        connected: true,
        chargesEnabled: !!user.stripeChargesEnabled,
        onboardingComplete: !!user.stripeOnboardingComplete,
      });
    }
    await storage.updateStripeStatus(user.id, status);
    res.json({
      enabled: true,
      connected: true,
      chargesEnabled: status.chargesEnabled,
      payoutsEnabled: status.payoutsEnabled,
      detailsSubmitted: status.detailsSubmitted,
      onboardingComplete: status.onboardingComplete,
    });
  });

  // Start (or resume) Stripe Express onboarding for the logged-in seller.
  app.post("/api/stripe/connect/onboard", requireAuth, async (req, res) => {
    if (!isStripeConfigured()) return res.status(503).json({ message: "Stripe is not configured yet." });
    const user = await storage.getUser(req.user!.id);
    if (!user) return res.status(404).json({ message: "Not found" });
    try {
      let accountId = user.stripeAccountId;
      if (!accountId) {
        const created = await createConnectAccount({ id: user.id, email: user.email });
        accountId = created.id;
        await storage.setStripeAccount(user.id, accountId);
        await storage.updateStripeStatus(user.id, created.status);
      }
      const link = await createOnboardingLink(accountId!);
      res.json({ url: link.url });
    } catch (e) {
      res.status(400).json({ message: (e as Error).message || "Could not start Stripe onboarding" });
    }
  });

  // Create a Stripe Checkout Session for a single listing. The buyer pays the
  // accepted-offer price if one exists, otherwise the listing price. The money
  // is split: the seller's connected account receives the payment minus the
  // platform fee. A pending payment row is written for webhook idempotency.
  app.post("/api/stripe/checkout-session", requireAuth, async (req, res) => {
    if (!isStripeConfigured()) return res.status(503).json({ message: "Stripe is not configured yet." });
    const listingId = Number(req.body?.listingId);
    if (!Number.isFinite(listingId)) return res.status(400).json({ message: "Invalid listing id" });
    try {
      const listing = await storage.getListing(listingId);
      if (!listing) return res.status(404).json({ message: "Listing not found" });
      if (listing.sellerId === req.user!.id) return res.status(403).json({ message: "You can't buy your own listing" });

      const seller = await storage.getUser(listing.sellerId);
      if (!seller?.stripeAccountId) {
        return res.status(409).json({ code: "seller-payouts-required", message: "The seller hasn't set up payments yet." });
      }
      const sellerStatus = await getAccountStatus(seller.stripeAccountId);
      if (!sellerStatus.chargesEnabled) {
        return res.status(409).json({ code: "seller-payouts-required", message: "The seller's payouts aren't ready yet." });
      }

      // Resolve the price: accepted offer for this buyer, else listing price.
      const acceptedOffer = await storage.getAcceptedOfferForBuyer(listingId, req.user!.id);
      const pricePounds = acceptedOffer ? acceptedOffer.price : listing.price;
      const amountPence = toPence(pricePounds);
      if (amountPence < 50) return res.status(400).json({ message: "Amount is too small to charge." });

      const bps = platformFeeBps();
      const feePence = computeFeePence(amountPence, bps);

      const session = await createCheckoutSession({
        amountPence,
        applicationFeePence: feePence,
        listingId,
        offerId: acceptedOffer?.id ?? null,
        buyerId: req.user!.id,
        sellerId: seller.id,
        sellerStripeAccountId: seller.stripeAccountId,
        listingTitle: listing.title,
        buyerEmail: req.user!.email,
      });

      await storage.createPayment({
        stripeCheckoutSessionId: session.id,
        listingId,
        offerId: acceptedOffer?.id ?? null,
        buyerId: req.user!.id,
        sellerId: seller.id,
        amountPence,
        applicationFeePence: feePence,
        currency: "gbp",
      });

      res.json({ url: session.url, sessionId: session.id });
    } catch (e) {
      res.status(400).json({ message: (e as Error).message || "Could not start checkout" });
    }
  });

  // Stripe webhook. The raw body is captured by the global express.json()
  // `verify` hook (req.rawBody); we verify the signature, then finalize the
  // order idempotently. This is the source of truth — the success redirect
  // only shows a confirmation page.
  app.post("/api/stripe/webhook", async (req, res) => {
    if (!isStripeConfigured()) return res.status(503).json({ message: "Stripe not configured" });
    const sig = req.headers["stripe-signature"] as string;
    const raw = req.rawBody as unknown as Buffer | string | undefined;
    if (!sig || !raw) return res.status(400).json({ message: "Missing signature" });
    let event;
    try {
      event = getStripe().webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET!);
    } catch (err) {
      console.error("[stripe] webhook signature verification failed:", (err as Error).message);
      return res.status(400).json({ message: "Invalid signature" });
    }
    try {
      if (event.type === "checkout.session.completed") {
        await finalizeStripeCheckout(event.data.object);
      }
      res.json({ received: true });
    } catch (e) {
      console.error("[stripe] webhook finalize failed:", (e as Error).message);
      // 500 so Stripe retries; finalize is idempotent so a retry is safe.
      res.status(500).json({ message: "Internal error" });
    }
  });

  return _httpServer;
}

/** Idempotently finalize a paid Stripe Checkout Session into a marketplace
 *  order: creates the order (marking the listing sold), completes the accepted
 *  offer, posts a confirmation message, and marks the payment paid. Safe to call
 *  on webhook retries — a session already marked paid is a no-op. */
async function finalizeStripeCheckout(session: any) {
  const sessionId: string | undefined = session?.id;
  if (!sessionId) return;

  // Ensure a payment row exists (it's normally created at session-creation time,
  // but reconstruct from metadata if the webhook beat that or the row is gone).
  let payment = await storage.getPaymentBySession(sessionId);
  if (!payment) {
    const md = session?.metadata || {};
    const listingId = Number(md.listingId);
    const offerId = md.offerId ? Number(md.offerId) : null;
    const buyerId = Number(md.buyerId);
    const sellerId = Number(md.sellerId);
    const amountPence = Number(md.amountPence);
    const applicationFeePence = Number(md.applicationFeePence || 0);
    if (!listingId || !buyerId || !sellerId || !Number.isFinite(amountPence)) {
      console.error(`[stripe] webhook: session ${sessionId} has no payment row and incomplete metadata`);
      return;
    }
    payment = await storage.createPayment({
      stripeCheckoutSessionId: sessionId,
      listingId,
      offerId,
      buyerId,
      sellerId,
      amountPence,
      applicationFeePence,
      currency: "gbp",
    });
  }

  // Idempotency guard: a session already finalized is a no-op.
  if (payment.status === "paid") return;

  const paymentStatus: string | undefined = session?.payment_status;
  if (paymentStatus !== "paid" && paymentStatus !== "no_payment_required") {
    console.log(`[stripe] session ${sessionId} not paid (${paymentStatus}) — skipping`);
    return;
  }

  const listing = await storage.getListing(payment.listingId);
  if (!listing) {
    console.error(`[stripe] webhook: listing ${payment.listingId} not found`);
    return;
  }

  // Delivery details come from Stripe's collected shipping address.
  const shipping = session?.shipping_details;
  const addr = shipping?.address || {};
  const delivery: OrderDelivery = {
    deliveryName: shipping?.name || session?.customer_details?.name || "Buyer",
    deliveryAddress1: addr.line1 || "Address on file",
    deliveryAddress2: addr.line2 || undefined,
    deliveryCity: addr.city || "—",
    deliveryPostcode: addr.postal_code || "—",
    contactEmail: session?.customer_details?.email || "",
  };

  // createOrder marks the listing sold and clears it from any carts.
  const pricePounds = payment.amountPence / 100;
  const order = await storage.createOrder(payment.buyerId, [payment.listingId], delivery, {
    priceOverrides: { [payment.listingId]: pricePounds },
    allowReserved: true,
  });

  if (payment.offerId) {
    await storage.completeOffer(payment.offerId, order.id);
    const offer = await storage.getOfferById(payment.offerId);
    if (offer) {
      await storage.sendMessage(offer.threadId, payment.sellerId, "Payment received — your order is confirmed.", payment.offerId);
    }
  }

  await storage.markPaymentPaid(sessionId, {
    orderId: order.id,
    paymentIntentId: session?.payment_intent ?? null,
  });

  console.log(`[stripe] finalized checkout session ${sessionId} -> order ${order.id}`);
}

function pickColorFromEmail(email: string): string {
  const colors = ["#e8a06a", "#7ec4b6", "#c89ad4", "#f4b6a3", "#9ec3e0", "#f2c94c", "#8ab0e6", "#e0a3b4"];
  let h = 0;
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}

/** Validate the delivery details submitted at checkout.
 *  Returns either the parsed `OrderDelivery` or an `{status, message}` error. */
function parseDelivery(body: any): OrderDelivery | { status: number; message: string } {
  const deliveryName = (body?.deliveryName ?? "").toString().trim();
  const deliveryAddress1 = (body?.deliveryAddress1 ?? "").toString().trim();
  const deliveryCity = (body?.deliveryCity ?? "").toString().trim();
  const deliveryPostcode = (body?.deliveryPostcode ?? "").toString().trim();
  const contactEmail = (body?.contactEmail ?? "").toString().trim().toLowerCase();
  if (!deliveryName) return { status: 400, message: "Please enter your full name" };
  if (!deliveryAddress1) return { status: 400, message: "Please enter your address" };
  if (!deliveryCity) return { status: 400, message: "Please enter your town/city" };
  if (!deliveryPostcode) return { status: 400, message: "Please enter your postcode" };
  if (!/.+@.+\..+/.test(contactEmail)) return { status: 400, message: "Please enter a valid email" };
  return {
    deliveryName,
    deliveryAddress1,
    deliveryAddress2: body?.deliveryAddress2 ? String(body.deliveryAddress2).trim() : undefined,
    deliveryCity,
    deliveryPostcode,
    contactEmail,
  };
}

/** Map a CartError (or generic error) from storage to an HTTP response. */
function handleCartError(e: unknown, res: Response) {
  if (e instanceof CartError) {
    const status = e.code === "not-found" ? 404 : e.code === "own-listing" ? 403 : 400;
    return res.status(status).json({ message: e.message, code: e.code });
  }
  console.error("checkout error:", e);
  return res.status(500).json({ message: "Something went wrong placing your order" });
}
