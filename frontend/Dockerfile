# Stage 1: Build
FROM node:20-alpine AS build

WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install dependencies (development dependencies are required for building/compiling typescript)
RUN npm ci

# Copy application source code
COPY . .

# VITE_API_URL must be set at build time for the frontend to connect to the backend
# For Docker: use http://backend:9000 (internal network)
# For production: use your actual backend URL
ARG VITE_API_URL=http://backend:9000
ENV VITE_API_URL=$VITE_API_URL

# Build the React application
RUN npm run build

# Stage 2: Serve the compiled static assets with Nginx
FROM nginx:alpine

# Copy static assets from build stage to Nginx HTML serving root
COPY --from=build /app/dist /usr/share/nginx/html

# Copy routing fallback configuration for React Router
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
