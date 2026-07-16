FROM node:22.22.0-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY . .
RUN pnpm --filter @eyeflow/web build

FROM node:22.22.0-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app
RUN addgroup --system --gid 1001 eyeflow && adduser --system --uid 1001 --ingroup eyeflow eyeflow
COPY --from=build --chown=eyeflow:eyeflow /app/apps/web/dist ./apps/web/dist
USER eyeflow
EXPOSE 3000
CMD ["node", "apps/web/dist/server/server.js"]
