FROM mcr.microsoft.com/playwright:v1.46.0-jammy
WORKDIR /app

# Worker deps
COPY worker/package.json ./worker/
RUN cd worker && npm install --omit=dev

# Copy worker source + scripts
COPY worker ./worker
# Backend's upload dir may be shared via volume
RUN mkdir -p /app/worker/.artifacts/screenshots /app/uploads/screenshots

ENV NODE_ENV=production
WORKDIR /app/worker
CMD ["node", "src/index.js"]
