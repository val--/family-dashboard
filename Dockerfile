FROM node:20-slim AS frontend-builder

WORKDIR /app/client

COPY client/package*.json ./
RUN rm -f package-lock.json && npm install

COPY client/ ./
RUN npm run build

FROM node:20-slim AS backend-deps

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

COPY --from=backend-deps /app/node_modules ./node_modules
COPY package*.json ./
COPY server/ ./server/
COPY --from=frontend-builder /app/client/dist ./client/dist

RUN mkdir -p /app/credentials

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server/index.js"]
