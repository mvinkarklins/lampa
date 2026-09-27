FROM node:26-alpine

# The server has no dependencies, so drop npm, yarn and corepack: they are never used
# at runtime and their bundled packages carry most of the image's known CVEs.
# Also pull the latest Alpine security fixes (e.g. OpenSSL) on top of the base image.
# hadolint ignore=DL3017
RUN apk upgrade --no-cache \
    && rm -rf /usr/local/lib/node_modules /opt/yarn-* \
              /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
              /usr/local/bin/yarn /usr/local/bin/yarnpkg

WORKDIR /app
COPY server.js ./
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data
EXPOSE 8080
HEALTHCHECK --interval=60s --timeout=5s CMD ["wget", "-qO", "/dev/null", "http://127.0.0.1:8080/health"]
CMD ["node", "server.js"]
