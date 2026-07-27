FROM node:20.19.4-alpine3.22 AS builder
WORKDIR /build

COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci

COPY apps/web ./
ARG VITE_APP_ENV=production
ARG VITE_APP_VERSION=0.1.0-container
ARG VITE_DEPLOYMENT_NAME="GeoTwin Sentinel"
ARG VITE_API_BASE_URL=
ARG VITE_MAP_STYLE_URL=https://tiles.openfreemap.org/styles/liberty
ARG VITE_SIGNOZ_APP_URL=
ARG VITE_SIGNOZ_DASHBOARD_URL=
ENV VITE_APP_ENV=${VITE_APP_ENV} \
    VITE_APP_VERSION=${VITE_APP_VERSION} \
    VITE_DEPLOYMENT_NAME=${VITE_DEPLOYMENT_NAME} \
    VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_MAP_STYLE_URL=${VITE_MAP_STYLE_URL} \
    VITE_SIGNOZ_APP_URL=${VITE_SIGNOZ_APP_URL} \
    VITE_SIGNOZ_DASHBOARD_URL=${VITE_SIGNOZ_DASHBOARD_URL}
RUN npm run build

FROM nginx:1.29.0-alpine3.22
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /build/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/ || exit 1
