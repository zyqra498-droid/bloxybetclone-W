FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm install --omit=dev

FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm install
RUN npm run build -w backend
RUN npm run build -w frontend

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/package.json ./backend/
COPY --from=build /app/frontend/.next ./frontend/.next
COPY --from=build /app/frontend/package.json ./frontend/
COPY --from=build /app/frontend/public ./frontend/public
COPY --from=build /app/prisma ./prisma
COPY package.json ./
EXPOSE 3000 4000
CMD ["node", "backend/dist/index.js"]
