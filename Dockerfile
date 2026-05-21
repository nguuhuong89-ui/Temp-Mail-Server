FROM node:24-slim AS base
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate
WORKDIR /app

FROM base AS deps
# Force dev deps regardless of host NODE_ENV build-arg (needed for TS/Vite/esbuild)
ENV NODE_ENV=development
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc* ./
COPY artifacts/api-server/package.json artifacts/api-server/
COPY artifacts/tempmail/package.json artifacts/tempmail/
COPY lib/api-spec/package.json lib/api-spec/
COPY lib/api-zod/package.json lib/api-zod/
COPY lib/api-client-react/package.json lib/api-client-react/
COPY lib/db/package.json lib/db/
COPY scripts/package.json scripts/
RUN pnpm install --frozen-lockfile

FROM deps AS build
# Build-time args: baked into the frontend bundle at build time (not runtime)
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_CLERK_PROXY_URL
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PROXY_URL=$VITE_CLERK_PROXY_URL
COPY . .
RUN pnpm -w run typecheck:libs \
 && pnpm --filter @workspace/api-server run build \
 && pnpm --filter @workspace/tempmail run build

FROM nginx:alpine AS web
COPY --from=build /app/artifacts/tempmail/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

FROM node:24-slim AS api
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=build /app/artifacts/api-server/package.json ./artifacts/api-server/
COPY --from=build /app/lib ./lib
COPY --from=build /app/package.json ./
ENV NODE_ENV=production
ENV PORT=8080
ENV SMTP_PORT=25
EXPOSE 8080 25
CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
