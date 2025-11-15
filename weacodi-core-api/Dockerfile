# Development stage
FROM node:18-alpine AS development
WORKDIR /app
COPY package*.json ./
COPY LICENSE ./LICENSE
RUN npm install
COPY . .
CMD ["npm", "run", "dev"]

# 1. Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY LICENSE ./LICENSE
RUN npm install
COPY . .
RUN npm run build

# 2. Production stage
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
COPY LICENSE ./LICENSE
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
ENV NODE_ENV=production
CMD ["node", "dist/server.js"]
