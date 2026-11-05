# DocVault Backend Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install build dependencies for native sqlite3 build
RUN apk add --no-cache python3 make g++

COPY package*.json ./

RUN npm ci --omit=dev

COPY src/ ./src/

EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000

CMD ["node", "src/server.js"]

