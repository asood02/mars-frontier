# Deploying Mars Frontier

The app has two independently deployable pieces:

| Piece | What it is | Where it can go |
|---|---|---|
| **Frontend** | Static React/Vite build (`dist/`) | Any static host — Netlify, Vercel, GitHub Pages, Cloudflare Pages |
| **Relay** | A small Node WebSocket service (`server/`) | Any host that runs a long-lived Node process — Render, Railway, Fly.io, a VPS |

**Local hotseat** ("New Local Game") needs only the frontend — it has no backend at all.
**Online play** needs the relay running somewhere, with the frontend pointed at it via
`VITE_WS_URL`.

> ⚠️ **`ws://` vs `wss://`** — when the frontend is served over **https**, the relay URL
> **must** use `wss://` (secure WebSocket). Browsers block insecure `ws://` from an https page.

---

## Option A — everything on Render (one platform)

A blueprint is included: [`render.yaml`](./render.yaml).

1. Push this repo to GitHub.
2. Render → **New → Blueprint** → pick the repo → **Apply**. This creates both the relay
   (`mars-frontier-relay`) and the static site (`mars-frontier-web`).
3. After the first deploy, copy the relay's URL and set the web service's
   **`VITE_WS_URL`** to its secure form, e.g. `wss://mars-frontier-relay.onrender.com`,
   then redeploy the web service.

> Render's free web services sleep when idle — the first online game after a quiet period
> takes a few seconds to wake the relay.

---

## Option B — frontend on Netlify/Vercel, relay on a container host

### Frontend
- **Netlify**: already configured via [`netlify.toml`](./netlify.toml). Connect the repo;
  add an env var `VITE_WS_URL = wss://<your-relay-host>`.
- **Vercel**: auto-detects Vite; SPA routing is handled by [`vercel.json`](./vercel.json).
  Add the same `VITE_WS_URL` env var (Project → Settings → Environment Variables), then redeploy.

### Relay (Docker)
A [`Dockerfile`](./Dockerfile) is included. The relay reads `PORT` from the environment and
exposes a `/healthz` endpoint.

```bash
# Build & run locally to test the image:
docker build -t mars-relay .
docker run -p 8787:8787 mars-relay
# → http://localhost:8787/healthz  →  "Mars Frontier relay: OK"
```

Deploy that image to:
- **Fly.io**: `fly launch` (uses the Dockerfile); set the internal port to `8787`.
- **Railway**: New Project → Deploy from repo (detects the Dockerfile). Railway injects `PORT`.
- **Render (as Docker)**: New → Web Service → Docker; health check path `/healthz`.

Whatever the host, take its public URL and set the frontend's `VITE_WS_URL` to
`wss://<that-host>`.

---

## Verifying online play after deploy

1. Open the deployed frontend in two browsers/devices.
2. One clicks **Host Online** → shares the 6-char room code.
3. The other clicks **Join Online** → enters the code.
4. If it says "disconnected from server", check:
   - the relay is up: visit `https://<relay-host>/healthz` (should print `OK`);
   - `VITE_WS_URL` is set to the **`wss://`** relay URL and the frontend was **rebuilt** after
     setting it (Vite inlines env vars at build time).
