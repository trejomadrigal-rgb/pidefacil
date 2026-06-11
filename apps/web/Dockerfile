# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm

# Copy workspace config files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/ ./packages/

# Copy only the web app
COPY apps/web/ ./apps/web/

# Install all dependencies (ignore NODE_ENV to always include devDeps in build stage)
RUN NODE_ENV=development pnpm install --frozen-lockfile

# Force correct API URL — cannot be overridden by docker build args without a matching ARG
ENV NEXT_PUBLIC_API_URL=http://h81lvlzrwjd7jf8bp0tkg1wa.2.24.201.108.sslip.io
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build --filter @pidefacil/web

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3001
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
