# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN corepack enable && apk add --no-cache git

# ---- deps ----
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---- build ----
FROM base AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# ---- run ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# The base image's `node` user is uid 1000, which matches the host user that
# owns the repos mounted from /mnt/storage and /DATA — required for git to
# write (stage/commit) into them without permission errors.
USER node
RUN git config --global --add safe.directory '*'
EXPOSE 3000
CMD ["node", "server.js"]