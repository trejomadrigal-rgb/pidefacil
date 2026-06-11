# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm

# Copy workspace config files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/ ./packages/

# Copy only the api app
COPY apps/api/ ./apps/api/

# Install all dependencies (ignore NODE_ENV to always include devDeps in build stage)
RUN NODE_ENV=development pnpm install --frozen-lockfile

# Generate Prisma client so TypeScript can resolve the generated types
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

# Build the api
RUN pnpm build --filter @pidefacil/api

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app
RUN npm install -g pnpm

COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages/ ./packages/
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/dist/ ./apps/api/dist/
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma

RUN pnpm install --frozen-lockfile --prod

EXPOSE 3000
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy --schema=apps/api/prisma/schema.prisma && node apps/api/dist/main"]
