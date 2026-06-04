# --- Fruty frontend: build con Node, sirve con Nginx ---

# 1) Construccion de los assets estaticos.
FROM node:20-alpine AS build
WORKDIR /app

# La URL del backend se inyecta en tiempo de build (Vite la hornea en el bundle).
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# 2) Servir con Nginx.
FROM nginx:alpine AS serve
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
