FROM node:22.11.0-bookworm-slim
WORKDIR /app
COPY . .
RUN npm ci
CMD ["node", "server.js"]
