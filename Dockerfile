FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --frozen-lockfile

COPY . .
RUN npm run build

FROM node:20-alpine AS production

WORKDIR /app

# Only copy production deps
COPY package*.json ./
RUN npm ci --production --frozen-lockfile

COPY --from=builder /app/dist ./dist

EXPOSE 8000

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=3s \
    CMD wget -qO- http://localhost:8000/health || exit 1

CMD ["node", "dist/index.js"]
