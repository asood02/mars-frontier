# Mars Frontier WebSocket relay — a tiny standalone Node service.
# Works on any container host (Fly.io, Railway, Render-as-Docker, a VPS, etc.).
# The host injects PORT; we fall back to 8787 locally.
FROM node:20-alpine

WORKDIR /app

# Only the relay's runtime deps (ws) are needed — install without dev deps.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# The relay is self-contained in server/.
COPY server ./server

ENV PORT=8787
EXPOSE 8787

CMD ["node", "server/index.mjs"]
