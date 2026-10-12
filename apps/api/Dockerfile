# syntax=docker/dockerfile:1
# Build context: repository root.  docker build -f apps/api/Dockerfile .

FROM node:24-slim AS base
# corepack enable unlinks the pnpm shim next to the corepack binary. On the
# image Render builds, that path is /usr/bin/pnpm and the filesystem is
# read-only (EROFS). The packageManager field would also route `pnpm` through
# that shim. Install the real CLI from package.json instead.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV PATH="/opt/pnpm/bin:${PATH}"
WORKDIR /repo

FROM base AS build
# bcrypt ships a prebuild; keep a compiler toolchain in case that prebuild is missing.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages ./packages
RUN PNPM_VERSION="$(node -p "require('./package.json').packageManager.split('@')[1]")" \
    && npm install -g --prefix /opt/pnpm "pnpm@${PNPM_VERSION}" \
    && pnpm --version
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
    && pnpm install --frozen-lockfile --filter @ai-girlfriend/api...
COPY apps/api ./apps/api
# dist/ is gitignored, so `pnpm deploy` omits it. The runtime import of
# prisma/contract.json is next to the compiled db.js and must be in the image.
RUN pnpm --filter @ai-girlfriend/api build \
    && test -s apps/api/dist/main.js \
    && test -s apps/api/dist/prisma/contract.json \
    && pnpm --filter @ai-girlfriend/api deploy --prod --legacy /out \
    && cp -r apps/api/dist /out/dist \
    && test -s /out/dist/main.js \
    && test -s /out/dist/prisma/contract.json

FROM node:24-slim AS runtime
ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app
COPY --from=build --chown=node:node /out ./
# Render's disk is ephemeral. This directory only keeps the process from
# crashing until uploads move to Supabase Storage.
RUN mkdir -p uploads && chown node:node uploads
USER node
EXPOSE 3001
CMD ["node", "dist/main.js"]
