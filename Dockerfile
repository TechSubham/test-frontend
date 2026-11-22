# Lyftr frontend — Vite build served by unprivileged nginx on :3000.
# Runtime config (API_BASE_URL) is written to /env.js at container
# start, so one image works for any backend URL without rebuilding.
ARG NODE_IMAGE=node:22-alpine
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.28-alpine

# ---- build stage ----------------------------------------------------------------------
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Optional build-time fallback only; the runtime env.js takes precedence.
ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

# ---- runtime stage --------------------------------------------------------------------
FROM ${NGINX_IMAGE} AS runtime
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/security-headers.inc /etc/nginx/lyftr-security-headers.inc
COPY --chmod=0755 docker/40-lyftr-runtime-env.sh /docker-entrypoint.d/40-lyftr-runtime-env.sh
COPY --from=build /app/dist /usr/share/nginx/html
# The build's placeholder env.js is never served (nginx aliases /env.js to the generated file).
ENV API_BASE_URL=http://localhost:8000
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:3000/healthz"]
