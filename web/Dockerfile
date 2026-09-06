# Multi-stage build for the testkit frontend.
# Build context MUST be the repo root (so both testkit-service/web/ and api/ are available
# for `npm run openapi`); see the `nginx` service in docker-compose.yaml.

# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app

# Layered install for cache: package manifests first.
COPY testkit-service/web/package.json testkit-service/web/package-lock.json ./
RUN npm ci

# App source (node_modules excluded via root .dockerignore).
COPY testkit-service/web/ ./

# Backend swagger — the `openapi` script reads the buf-generated bundle.
# In-image path differs from the local one (WORKDIR /app → ../api), hence the
# env override; locally the default resolves ../../api from web/.
COPY api/gen/openapi /api/gen/openapi
ENV TESTKIT_SWAGGER=../api/gen/openapi/testkit/v1/service.swagger.json

# Regenerate services from swagger (source of truth), then build the SPA.
# fix-int64 strips error responses + rewrites int64->string (see scripts/).
RUN npm run openapi
RUN npm run build

# ---- runtime ----
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY testkit-service/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
