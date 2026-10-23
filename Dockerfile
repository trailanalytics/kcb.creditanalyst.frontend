# syntax=docker/dockerfile:1

# ---- build -----------------------------------------------------------------
FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npm run build

# ---- runtime ---------------------------------------------------------------
FROM nginx:alpine AS runtime
# nginx renders /etc/nginx/templates/*.template with the container's environment at start-up
ENV API_UPSTREAM=http://app:8080
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/healthz || exit 1
