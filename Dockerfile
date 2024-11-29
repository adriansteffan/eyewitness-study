FROM node:20-alpine as frontend-builder
WORKDIR /app
COPY package*.json ./

RUN npm install

COPY . .
RUN npm run build


FROM node:20-alpine
WORKDIR /app

COPY backend/package*.json ./
RUN npm install

COPY backend/ ./
RUN npm run build
RUN npm install -g pm2

COPY --from=frontend-builder /app/dist ./static

EXPOSE 8001

CMD ["npx", "pm2-runtime", "./dist/backend.js"]