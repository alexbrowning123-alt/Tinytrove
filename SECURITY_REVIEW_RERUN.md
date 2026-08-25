# TinyTrove — Pre-Publish Security Re-Review

**Project:** `/home/user/workspace/kids-market` (TinyTrove — Vinted-style baby/children's marketplace)
**Scope:** Re-review after adding (1) per-IP rate limiter on `/api/auth/signup`, `/api/auth/login`, `/api/uploads`; (2) `DELETE /api/listings/:id`; (3) `DELETE /api/threads/:id`; (4) `deleteListing`/`deleteThread` storage methods; (5) JWT secret fallback to `crypto.randomBytes(32)`.
**Method:** Static review (grep + manual read of `server/routes.ts`, `server/storage.ts`, `shared/schema.ts`) plus live black-box testing against a running instance (login/signup brute force, IDOR attempts on both new DELETE endpoints, rate-limiter bypass attempts via spoofed `X-Forwarded-For`).

---

## Security Review Results

### BLOCK (must fix before publishing) — all fixed, see "Fixes Applied" below

- **Seller `passwordHash` and full user record leaked on every public listings request** — `server/storage.ts` (`getListings`, `getListing`, pre-existing, not part of the reviewed diff but caught by Check 4/general review) — `GET /api/listings` and `GET /api/listings/:id` attached the raw `User` row (including bcrypt `passwordHash`) as `seller` instead of the sanitized `PublicUser`. Confirmed live: every unauthenticated request to `/api/listings` returned all 5 seed users' bcrypt hashes in plaintext JSON. **Fixed** — added a `toPublicUser()` helper in `storage.ts` and applied it to both methods; verified live that `passwordHash` no longer appears in any listings response while all other functionality (seller name, avatar, rating, etc.) is unchanged.

- **Rate limiter not applied to `/api/auth/signup` or `/api/auth/login`** — `server/routes.ts:168,199` (pre-fix) — despite the task's stated requirement that the new `rateLimit` middleware cover signup and login, it was only wired to `/api/uploads`. Confirmed live: 25 consecutive wrong-password `POST /api/auth/login` requests all returned `401` with no `429`, i.e. unlimited credential-stuffing/brute-force against user passwords and no signup-spam protection. **Fixed** — added `rateLimit` as middleware on both `app.post("/api/auth/signup", rateLimit, ...)` and `app.post("/api/auth/login", rateLimit, ...)`. Verified live: the 21st request within a minute from the same IP now returns `429`.

- **Rate limiter trivially bypassed via spoofed `X-Forwarded-For` header (complete bypass, not partial)** — `server/routes.ts:30` (pre-fix) — `rateLimit` read `req.headers["x-forwarded-for"]` directly and used it as the bucket key, but the app never configures `app.set("trust proxy", ...)`. Since there is no trusted reverse proxy overwriting that header, any client can set an arbitrary `X-Forwarded-For` value to get a brand-new rate-limit bucket on every single request. Confirmed live: 25 requests to a rate-limited endpoint, each with a different spoofed `X-Forwarded-For`, all succeeded with zero `429`s — a complete, one-line bypass of the entire rate-limiting feature (defeats brute-force protection on login/signup and spam protection on uploads). **Fixed** — `rateLimit` now keys on `req.ip` (Express's own resolved client IP, which falls back to the raw socket address when `trust proxy` is unset) instead of re-parsing the header. Verified live: the same spoofing attempt now correctly hits `429` after 20 requests, matching non-spoofed behavior. Added an inline comment explaining why `X-Forwarded-For` must not be trusted without an explicit `trust proxy` config, to prevent regression if a proxy is added later.

### WARN (inform user, let them decide)

- **In-memory rate limiter and JWT secret are not multi-instance-safe** — `server/routes.ts:15,35` — the rate-limit bucket map and the JWT secret (when `JWT_SECRET` env var is unset, which is the case here — no `.env` sets it) are both process-local. This is explicitly acceptable for this app's single-process deployment model (confirmed no clustering/PM2 in `server/index.ts`), but two behaviors are worth flagging to the user: (1) every server restart invalidates all logged-in sessions since a new random secret is generated each boot — a UX/reliability tradeoff, not a vulnerability; (2) if this app is ever scaled to multiple processes/instances behind a load balancer without setting a shared `JWT_SECRET` and an external rate-limit store (e.g. Redis), sessions would randomly become invalid and the rate limiter would undercount. No fix needed for the current single-instance deployment; flagging as a scaling note.

- **Public seller `email` field exposed on listings** — `server/routes.ts` (`toPublicUser` default `includeEmail=false`, but `storage.ts`'s own `toPublicUser` used for listings includes email since `PublicUser` type retains `email`) — every listing's seller object includes the seller's email address to any visitor, logged in or not. This matches the app's existing `PublicUser` type design (only `passwordHash` is defined as sensitive) and appears to be an intentional product choice for a peer-to-peer marketplace (buyers often need a contact route), but for a public site aimed at parents, consider whether email should be masked/removed from the public listings feed and only revealed once a conversation thread exists. Left unchanged since it reflects pre-existing, deliberate schema design rather than a regression from the reviewed changes — flagging for the user's product judgment.

### PASS

- **Dependency audit** — `npm audit --json` reports 0 critical/high/moderate/low vulnerabilities across 611 packages (375 prod, 234 dev, 156 optional).
- **Hardcoded secrets** — no API keys, AWS keys, GitHub/GitLab tokens, private keys, or hardcoded passwords found in source. No `.env` file exists in the project; `JWT_SECRET` is read from `process.env` with a safe cryptographically-random fallback (`crypto.randomBytes(32)`), never hardcoded. `.gitignore` correctly excludes `data.db*` and `.env*`.
- **Common vulnerability patterns** — no `eval`, `new Function`, `document.write`, or unguarded `innerHTML` assignment with user input. The only `dangerouslySetInnerHTML` hit is in the vendored shadcn `chart.tsx` UI library component, which renders static CSS variable definitions, not user-controlled content — not exploitable.
- **Open CORS / missing auth** — no CORS headers or `cors()` middleware present at all (same-origin app, no cross-origin API surface). All mutating routes (`POST`, `PATCH`, `DELETE`) on listings, favorites, threads, and messages require `requireAuth`; the two new `DELETE` endpoints correctly reject unauthenticated requests with `401`.
- **New `DELETE /api/listings/:id` authorization** — verified via live testing: non-owner attempts correctly return `403 "Not your listing"`; unauthenticated attempts return `401`; non-existent IDs return `404`; the listing's actual owner successfully deletes it, and `deleteListing` correctly cascades to remove associated favorites, thread messages, and threads (confirmed by re-fetching the listing afterward — `404`, and by re-fetching an associated thread afterward — also gone). Non-numeric/`NaN` IDs are explicitly rejected with `400` via `Number.isFinite`.
- **New `DELETE /api/threads/:id` authorization** — verified via live testing: a non-participant (neither buyer nor seller) attempt correctly returns `403 "Not part of this conversation"` and the thread survives; the actual buyer or seller can delete it; `deleteThread` correctly cascades to remove associated messages first, then the thread row, avoiding orphaned rows.
- **`deleteListing` / `deleteThread` storage methods** — reviewed `server/storage.ts`: both perform explicit, ordered cascading deletes (favorites → messages → threads → listing, and messages → thread respectively) rather than relying on unconfigured foreign-key `ON DELETE CASCADE`, so no orphaned rows are left behind in SQLite.
- **Upload endpoint (`multer`) file handling** — filenames are always generated via `crypto.randomBytes(8).toString("hex")` plus a sliced, lowercased extension derived from `path.extname()` — the client-supplied `originalname` never reaches the filesystem path directly, so path traversal via crafted filenames is not possible. `fileFilter` restricts to `image/*` MIME types; `limits.fileSize` caps uploads at 8MB.
- **Auth cookie configuration** — `__Host-sid` cookie is `httpOnly`, `sameSite: "lax"`, `path: "/"`, and `secure: true` in production (`secure: PROD`), matching the required `__Host-` prefix constraints; verified via live `Set-Cookie` header inspection.
- **Password handling** — bcrypt (`bcryptjs`) with cost factor 10 for hashing; `bcrypt.compareSync` used for verification; no plaintext password logging observed in the request logger (`server/index.ts` logs only JSON response bodies, and login/signup responses never include the password or hash).

---

## Fixes Applied

1. **`server/storage.ts`** — added a private `toPublicUser()` helper that strips `passwordHash` from a `User` before it's attached as `seller` on listing responses; applied to both `getListings()` and `getListing()`. Updated the `IStorage` interface and return types to `PublicUser` instead of `User` for these two methods, and added the `PublicUser` import.
2. **`server/routes.ts`** — added `rateLimit` middleware to `app.post("/api/auth/signup", ...)` and `app.post("/api/auth/login", ...)`, matching the task's stated requirement (previously only `/api/uploads` was covered).
3. **`server/routes.ts`** — changed `rateLimit`'s IP-extraction logic from directly trusting the client-supplied `X-Forwarded-For` header to using Express's `req.ip` (with a `req.socket.remoteAddress` fallback), since the app never configures `app.set("trust proxy", ...)`. Added an inline comment documenting why the header must not be read directly and what to do if a trusted reverse proxy is introduced later.

All three fixes were verified against a live running instance of the server (not just read statically):
- Confirmed `passwordHash` no longer appears in `/api/listings` or `/api/listings/:id` responses.
- Confirmed `/api/auth/login` and `/api/auth/signup` now return `429` after 20 requests/minute from the same IP.
- Confirmed spoofing `X-Forwarded-For` with a different value on every request no longer resets the rate-limit bucket — the limiter now correctly triggers regardless of header spoofing.
- Re-ran the full owner/participant IDOR test matrix on both new `DELETE` endpoints after the fixes to confirm no regression: non-owner/non-participant `403`, unauthenticated `401`, owner/participant success `200` with correct cascade deletes.
- Confirmed signup, login, listing feed, and image upload flows all still function correctly end-to-end after the fixes.

## Remaining Items for User Decision

- Whether to mask/hide seller email addresses on the public listings feed (WARN, product decision — see above).
- No action required for the in-memory rate limiter / per-boot JWT secret note — it's correct for the current single-instance deployment; only relevant if scaling to multiple instances later.
