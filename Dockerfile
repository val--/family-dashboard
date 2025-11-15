# Multi-stage build for Family Dashboard

# Stage 1: Build frontend
FROM node:20-slim AS frontend-builder

WORKDIR /app/client

# Copy client package files
COPY client/package*.json ./

# Install client dependencies
RUN npm ci

# Copy client source code
COPY client/ ./

# Build frontend
RUN npm run build

# Stage 2: Install backend dependencies
FROM node:20-slim AS backend-deps

WORKDIR /app

# Copy root package files
COPY package*.json ./

# Install backend dependencies only (production)
RUN npm ci --omit=dev

# Stage 3: Final image
FROM node:20-slim

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Copy backend dependencies from backend-deps stage
COPY --from=backend-deps /app/node_modules ./node_modules

# Copy root package files
COPY package*.json ./

# Copy server code
COPY server/ ./server/

# Copy built frontend from frontend-builder stage
COPY --from=frontend-builder /app/client/dist ./client/dist

# Create credentials directory (will be mounted as volume)
RUN mkdir -p /app/credentials

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Expose port
EXPOSE 5000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the server
CMD ["node", "server/index.js"]

