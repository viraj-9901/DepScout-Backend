# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:20-alpine AS dependencies

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev && npm cache clean --force


# ============================================
# Stage 2: Build
# ============================================
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm ci

COPY src ./src

RUN npm run build


# ============================================
# Stage 3: Production
# ============================================
FROM node:20-alpine AS production

ENV NODE_ENV=production

WORKDIR /app

# Create non-root user
RUN addgroup -S nodejs && adduser -S nodejs -G nodejs

COPY package*.json ./

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

USER nodejs

EXPOSE 3000

CMD ["node", "dist/server.js"]
