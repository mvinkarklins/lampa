FROM node:20-alpine
# шрифт для меток на постерах
RUN apk add --no-cache font-dejavu
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY *.js ./
ENV NODE_ENV=production PORT=7000 CACHE_DIR=/tmp/posters
USER node
EXPOSE 7000
CMD ["node", "server.js"]
