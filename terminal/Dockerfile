FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --omit=optional --ignore-scripts && npm cache clean --force
COPY src ./src
COPY content ./content
RUN mkdir /data && chown node:node /data
USER node
ENV HOST=0.0.0.0 PORT=2222 HOST_KEY_PATH=/data/host_ed25519
EXPOSE 2222
VOLUME ["/data"]
CMD ["node", "src/server.mjs"]
