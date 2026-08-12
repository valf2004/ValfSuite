FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
RUN cp db/availability.postgres.ts db/availability.ts
ENV WRANGLER_LOG_PATH=.wrangler/build.log
RUN pnpm exec vinext build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production \
    WRANGLER_LOG_PATH=.wrangler/runtime.log
COPY --from=build /app /app
EXPOSE 3000
CMD ["sh", "-c", "pnpm exec vinext start --host 0.0.0.0 --port 3000"]
