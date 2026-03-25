# ---- build stage ----
FROM node:20-alpine AS build

# Set working directory
WORKDIR /app

# Install dependencies first (for better caching)
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Set build-time environment variables
ARG VITE_MATTERPORT_KEY
ARG VITE_MATTERPORT_MODEL_ID
ARG VITE_API_BASE_URL

# Set environment variables
ENV VITE_MATTERPORT_KEY=$VITE_MATTERPORT_KEY
ENV VITE_MATTERPORT_MODEL_ID=$VITE_MATTERPORT_MODEL_ID
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Build the application
RUN npm run build

# ---- run stage ----
FROM nginx:1.25-alpine

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx config for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"] 