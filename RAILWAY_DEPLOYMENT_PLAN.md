# TinyTrove — Permanent Deployment Guide (Railway)

The code changes described here are already made and tested. This is your step-by-step guide to get TinyTrove live on Railway with a database and image storage that survive restarts and redeploys indefinitely.

## What changed in the code (already done, already tested)

| Component | Before | After |
|---|---|---|
| Database file | Hardcoded `./data.db` inside the app folder | Path driven by a `DATA_DIR` environment variable — set it to a mounted volume and the database lives outside the app container |
| Uploaded images | Hardcoded `./uploads` inside the app folder | Path driven by an `UPLOAD_DIR` environment variable — same idea |
| Login sessions (JWT secret) | Randomly generated on every server start, silently invalidating all logins on every restart | Must be supplied via a `JWT_SECRET` environment variable in production; the app now refuses to start without one, so this can never silently break again |
| Server network binding | Bound to `127.0.0.1` (sandbox-only) | Binds to `0.0.0.0` and reads `PORT` from the environment, which is what Railway (and most hosts) require |
| Build/start config | None | Added `railway.json` and `nixpacks.toml` so Railway auto-detects and builds the app correctly |

**Important, honest tradeoff:** this uses SQLite (the same lightweight database engine as before), just placed on a Railway persistent volume instead of inside the ephemeral container. That's what makes it durable. It is not a switch to Postgres — Postgres wasn't necessary to solve the actual problem (data getting wiped), and SQLite-on-a-volume is simpler to operate for an app at this scale. If TinyTrove later needs multiple server instances running at once (horizontal scaling) or you want managed backups/point-in-time recovery, that's the point to migrate to Postgres — happy to do that when it's actually needed.

**Verified locally before handoff:**
- Built the app, started it against a persistent folder, created a real account, forcibly killed the server (simulating a redeploy), restarted it against the *same* folder — the account, login, and even a session token issued before the "redeploy" all still worked afterward.
- Uploaded a real image, restarted the server the same way, confirmed the image was still being served afterward.
- Confirmed the server refuses to boot in production if `JWT_SECRET` is missing (instead of silently generating a new one and invalidating everyone's login).

## What you need to do on Railway

### 1. Create a Railway account and project
Go to [railway.app](https://railway.app) and sign up (GitHub sign-in is fastest — it also makes step 2 easier).

### 2. Get the code onto GitHub
I've packaged the app as a zip (attached) with `node_modules`, `dist`, and local database/test files excluded. Create a new GitHub repository and push this code to it — either:
- Upload the zip contents via GitHub's web UI ("Add file → Upload files"), or
- Unzip locally, `git init`, `git add -A`, `git commit`, then push to a new repo.

### 3. Deploy it on Railway
- In your Railway project, choose **New → GitHub Repo** and select the repo you just created.
- Railway will detect the `railway.json`/`nixpacks.toml` and build automatically — no manual build command needed.

### 4. Add a persistent volume
- On the deployed service, go to **Settings → Volumes → Add Volume**.
- Mount it at `/data`.

### 5. Set environment variables
On the service's **Variables** tab, add:

| Variable | Value |
|---|---|
| `JWT_SECRET` | A long random string — generate one yourself with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` in any terminal, or ask me to generate one for you |
| `DATA_DIR` | `/data` |
| `UPLOAD_DIR` | `/data/uploads` |

Do **not** set `PORT` — Railway injects it automatically. Do not set `NODE_ENV` — the app's `npm start` script sets it already.

**Keep this service at 1 replica.** Because the database is a single SQLite file on the volume, running multiple instances at once would cause conflicts. One instance is normal for an app at this scale and is what Railway defaults to.

### 6. Get your live URL
Railway assigns a `*.up.railway.app` domain automatically once deployed. You can attach a custom domain for free afterward under **Settings → Domains**.

## After you've done the above

Send me the live Railway URL and I will:
- Verify signup/login works and survives a redeploy
- Verify listing creation with photo uploads
- Verify messaging, offers, and checkout end-to-end
- Check both desktop and mobile, light and dark mode

## Costs to know upfront

Railway's free tier includes a small monthly usage credit, which comfortably covers a low-traffic app like this. Sustained real-world usage may eventually need a paid plan — Railway bills by actual resource usage (CPU/RAM/network), not a flat subscription fee, so cost scales with how much people actually use the site.

## Note on existing sandbox data

The accounts and listings currently on `tinytrove.pplx.app` live in the sandbox's temporary database and will **not** automatically transfer to Railway — that sandbox and the new Railway deployment are separate environments. If there's real data there you want carried over (beyond the demo seed accounts, which recreate themselves automatically), let me know before you go live on Railway and I'll help export it.
