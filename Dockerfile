FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV APP_PORT=3000
ENV ORA_CLIENT_LIB_DIR=/opt/oracle/instantclient

RUN apt-get update \
  && apt-get install -y --no-install-recommends libaio1 libnsl2 \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

RUN mkdir -p /opt/oracle/instantclient

EXPOSE 3000

CMD ["node", "dist/main.js"]
