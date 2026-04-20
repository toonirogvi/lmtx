FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 \
    libcups2 libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 libnspr4 libnss3 \
    libx11-xcb1 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 xdg-utils \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci

FROM deps AS build
COPY backend ./backend
COPY scripts ./scripts
WORKDIR /app/backend
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/backend/package*.json ./backend/
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY storage ./storage
WORKDIR /app/backend
EXPOSE 4000
CMD ["node", "dist/src/server.js"]
