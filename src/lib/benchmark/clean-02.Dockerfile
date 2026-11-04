FROM node:22.11.0-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
RUN addgroup --system app && adduser --system --ingroup app app
USER app
CMD ["node", "server.js"]
