# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund \
  && apk del python3 make g++
COPY server ./server
COPY --from=build /app/dist ./dist
RUN mkdir -p /data
EXPOSE 3001
CMD ["node", "server/index.js"]
