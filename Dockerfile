# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
ENV NODE_ENV=development
RUN npm i -g pnpm
COPY ./package*.json .
COPY ./pnpm-lock.yaml .
RUN pnpm install
COPY . .
RUN pnpm build

FROM node:20-alpine as main
WORKDIR /app

ENV NODE_ENV=production
RUN npm i -g pnpm
COPY ./package*.json .
COPY ./pnpm-lock.yaml .
RUN pnpm install

COPY --from=builder ./app/dist ./dist
COPY ./public ./public

EXPOSE 3000

ENV DEBUG="nostr-profile-cache,nostr-profile-cache:*"

ENTRYPOINT [ "node", "." ]
