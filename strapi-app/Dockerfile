
# Stage 1: Build Strapi
FROM node:24-alpine AS builder

RUN apk add --no-cache \
    build-base \
    gcc \
    autoconf \
    automake \
    zlib-dev \
    libpng-dev \
    bash \
    vips-dev \
    git

WORKDIR /opt

COPY package.json package-lock.json ./

RUN npm ci

ENV PATH=/opt/node_modules/.bin:$PATH

WORKDIR /opt/app

COPY . .

ENV NODE_ENV=production

RUN npm run build


# Stage 2: Run Strapi
FROM node:24-alpine

RUN apk add --no-cache vips-dev

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=1337

WORKDIR /opt

COPY --from=builder /opt/package.json /opt/package-lock.json ./

RUN npm ci --omit=dev && npm cache clean --force

ENV PATH=/opt/node_modules/.bin:$PATH

WORKDIR /opt/app

COPY --from=builder /opt/app ./

RUN mkdir -p /opt/app/public/uploads \
    && chown -R node:node /opt/app

USER node

EXPOSE 1337

HEALTHCHECK --interval=30s --timeout=10s \
  --start-period=60s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:1337/_health || exit 1

CMD ["npm", "run", "start"]
