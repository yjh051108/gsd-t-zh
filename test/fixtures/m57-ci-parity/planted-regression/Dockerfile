FROM node:18-alpine
WORKDIR /app
COPY package.json tsconfig.json ./
COPY src ./src
RUN npm install --include=dev
RUN npx tsc --noEmit
