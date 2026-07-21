FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY public ./public
RUN mkdir -p /app/data && addgroup -S odg && adduser -S odg -G odg && chown -R odg:odg /app/data
USER odg
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:8080/api/health || exit 1
CMD ["node", "server/index.js"]
