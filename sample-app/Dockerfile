FROM node:20-alpine
WORKDIR /app
COPY sample-app/package.json ./sample-app/
RUN cd sample-app && npm install --omit=dev
COPY sample-app ./sample-app
WORKDIR /app/sample-app
ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "server.js"]
