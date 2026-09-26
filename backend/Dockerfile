# ---------- Backend image ----------
FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY backend/package.json ./backend/
RUN cd backend && npm install --omit=dev

# Copy backend source + the shared db scripts (migrations & seed)
COPY backend ./backend
COPY db ./db

# Uploaded screenshots live here (docker volume in compose)
RUN mkdir -p /app/backend/uploads/screenshots

ENV NODE_ENV=production
WORKDIR /app/backend
EXPOSE 4000

CMD ["node", "src/server.js"]
