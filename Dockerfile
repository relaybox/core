# Stage 1: Build Stage
FROM node:20-alpine AS builder
WORKDIR /src
ENV NODE_ENV=production
RUN apk add --no-cache make g++ cmake python3 git
COPY /package.json ./
RUN npm install --verbose --production
COPY /build /src

# Stage 2: Production Stage
FROM node:20-alpine
WORKDIR /src
ENV NODE_ENV=production
RUN apk add --no-cache gcompat
COPY --from=builder /src /src
EXPOSE 4004
CMD ["node", "server.js"]
