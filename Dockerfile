# ============================
# Dockerfile — CRM Отдел продаж
# ============================
FROM node:20-alpine AS base

# Install bun
RUN npm install -g bun

# Dependencies
FROM base AS deps
WORKDIR /app
COPY package.json bun.lock* ./
COPY prisma ./prisma
RUN bun install --frozen-lockfile || bun install

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate Prisma client for PostgreSQL
RUN bunx prisma generate --schema=prisma/schema.prod.prisma
RUN bun run build

# Production
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy built app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/bun.lock* ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/node_modules ./node_modules

# Copy startup script
COPY docker-start.sh ./docker-start.sh
RUN chmod +x ./docker-start.sh

EXPOSE 3000

CMD ["./docker-start.sh"]
