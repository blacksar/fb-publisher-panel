# ---- Base image for dependencies ------------------------------------------
FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts


# ---- Build the application ------------------------------------------------
FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build


# ---- Production image -----------------------------------------------------
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# ▸ Paquetes extra: openssl (Prisma) + curl (descarga de supercronic)
RUN apk add --no-cache openssl curl && \
    curl -L -o /usr/local/bin/supercronic \
         https://github.com/aptible/supercronic/releases/download/v0.2.29/supercronic-linux-amd64 && \
    chmod +x /usr/local/bin/supercronic

# ▸ Copiamos artefactos, cronfile y script de arranque
COPY --from=builder /app .
COPY cronfile /cronfile
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 3000
# ▸ Arranca el script que pone todo en marcha
CMD ["/start.sh"]
    