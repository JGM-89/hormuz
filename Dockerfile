# Stage 1: Build frontend
FROM node:22-alpine AS frontend-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production server
FROM node:22-alpine
WORKDIR /app

# Install server dependencies
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm ci --production

# Copy server code
COPY server/ ./server/

# Copy built frontend
COPY --from=frontend-build /app/dist ./dist

# Copy .env if present (can also mount as volume)
COPY .env* ./

# Data directory for SQLite
RUN mkdir -p /app/data
VOLUME /app/data

ENV DB_PATH=/app/data/hormuz.db
ENV PORT=3001
ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "server/index.js"]
