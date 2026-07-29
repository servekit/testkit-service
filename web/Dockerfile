# Multi-stage build for the testkit frontend.
# Build context MUST be the repo root (so both web/ and api/swagger/ are available
# for `npm run openapi`); see the `nginx` service in docker-compose.yaml.

# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app

# Layered install for cache: package manifests first.
COPY web/package.json web/package-lock.json ./
RUN npm ci

# App source (node_modules excluded via root .dockerignore).
COPY web/ ./

# Backend swagger — the `openapi` script reads ../api/swagger/... from WORKDIR.
COPY api/swagger /api/swagger

# Regenerate services from swagger (source of truth), then build the SPA.
# fix-int64 strips error responses + rewrites int64->string (see scripts/).
RUN npm run openapi
RUN npm run build

# ---- runtime ----
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
