# Official Playwright image: browsers + all required system libraries (libglib, nss, etc.)
# Tag MUST match the playwright version in worker/package-lock.json (currently 1.63.0).
FROM mcr.microsoft.com/playwright:v1.63.0-jammy
WORKDIR /app

# Worker deps
COPY worker/package.json worker/package-lock.json ./worker/
RUN cd worker && npm install --omit=dev

# Copy worker source + scripts
COPY worker ./worker
# Backend's upload dir may be shared via volume
RUN mkdir -p /app/worker/.artifacts/screenshots /app/uploads/screenshots

# Safety net: downloads browsers only if the installed playwright version
# no longer matches the browsers baked into the base image.
RUN cd worker && npx playwright install chromium

ENV NODE_ENV=production
WORKDIR /app/worker
CMD ["node", "src/index.js"]
