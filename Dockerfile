# Stage 1: produktionsberoenden (utan devDependencies)
FROM oven/bun:1.3.11-slim AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Stage 2: bygg (kräver devDependencies: astro, typescript)
FROM oven/bun:1.3.11-slim AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# Stage 3: runtime
FROM node:24-slim
LABEL maintainer="info@whitered.se" vendor="WHITE RED CONSULTING AB"

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4321

WORKDIR /app

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/package.json ./package.json

# Statiska tillgångar serveras från dist/client, men config.json läses och
# skrivs av servern via process.cwd()/public/assets/config (se api/config.ts
# och PortalLayout.astro). Den katalogen måste därför finnas separat.
COPY --from=builder --chown=node:node /app/public/assets/config ./public/assets/config

# Adminytan skriver config.json vid drift — montera en volym här för att
# behålla tema och synlighetsregler över omstarter och uppgraderingar.
VOLUME /app/public/assets/config

USER node

EXPOSE 4321

# Ingen curl i node:slim — använd nodes egen fetch i stället för att blåsa upp
# imagen med ett extra paket.
HEALTHCHECK --interval=30s --timeout=10s --retries=5 --start-period=15s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4321)+'/sok').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "./dist/server/entry.mjs"]
