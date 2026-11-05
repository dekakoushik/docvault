# DocVault Backend Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install build dependencies for native sqlite3 build
RUN apk add --no-cache python3 make g++ curl

COPY package*.json ./

RUN npm ci --omit=dev

COPY src/ ./src/

RUN mkdir -p /app/database /app/uploads /app/.agent

EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

CMD ["node", "src/server.js"]

