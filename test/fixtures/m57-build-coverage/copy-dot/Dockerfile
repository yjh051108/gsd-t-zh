FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm ci && npm run build
CMD ["node", "dist/index.js"]
