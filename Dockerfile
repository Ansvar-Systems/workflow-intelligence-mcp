FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

FROM node:22-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist/ dist/
# JSON task definitions are not compiled by tsc — copy into dist tree
COPY src/definitions/ dist/definitions/

# State storage directory (mount a volume for persistence)
RUN mkdir -p /app/data && chown node:node /app/data

USER node
ENTRYPOINT ["node", "dist/http-server.js"]
