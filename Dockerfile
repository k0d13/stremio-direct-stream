# syntax=docker/dockerfile:1

# --- deps: install & build dependencies with the Node/pnpm toolchain ----------
FROM node:22-alpine AS deps
WORKDIR /app
# git: @p-stream/providers is a GitHub dependency, built from source on install
# (its `prepare` runs `vite build`). corepack runs the pnpm version each package
# pins via `packageManager` (ours, and the provider's own).
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN apk add --no-cache git && corepack enable
COPY package.json pnpm-lock.yaml ./
# Full install so the git dep builds with its devDependencies, then prune dev
# deps so only production deps carry to the runtime image.
RUN pnpm install --frozen-lockfile && pnpm prune --prod

# --- runtime: Bun runs the TypeScript addon directly --------------------------
FROM oven/bun:1.3.13-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
# Both dirs preserved: src/index.ts imports the handler from api/index.ts.
COPY src ./src
COPY api ./api

# The addon serves /manifest.json on port 7000.
EXPOSE 7000
CMD ["bun", "run", "src/index.ts"]
