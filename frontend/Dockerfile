# ---------- Frontend (Vite build + nginx) ----------
FROM node:20-alpine AS build
WORKDIR /app
COPY frontend/package.json ./frontend/
RUN cd frontend && npm install
COPY frontend ./frontend
# Allow VITE_ vars at build time (empty = same origin via nginx proxy)
ARG VITE_API_URL=""
ARG VITE_SOCKET_URL=""
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
RUN cd frontend && npm run build

FROM nginx:alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
