# ── Stage 1: Build frontend ────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build
# Output: /app/frontend/dist

# ── Stage 2: Build backend ─────────────────────────────────────────────────
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ .
# Copy frontend dist as NestJS static public folder
COPY --from=frontend-builder /app/frontend/dist ./public
RUN npm run build
# Output: /app/backend/dist + /app/backend/public

# ── Stage 3: Production image ──────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/public ./public
COPY --from=backend-builder /app/backend/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/main"]
