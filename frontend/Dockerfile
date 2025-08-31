##
## Dockerfile for the React frontend of the Collaborative AI Chat
##
## This multi‑stage build compiles the Vite/React application and
## serves the static files from Nginx.  The Nginx configuration
## should be supplied via a separate nginx.conf file (see
## docker‑compose.yml) to proxy API requests to the backend and
## serve the compiled assets.

# Stage 1: build the frontend assets
FROM node:18 AS build

WORKDIR /app

# Copy dependencies descriptors
COPY package.json ./

# Install dependencies
RUN yarn install

# Copy source code
COPY . .

# Build the production assets to the dist/ directory
RUN yarn run build

# Stage 2: serve the static files using Nginx
FROM nginx:1.23-alpine

# Remove default Nginx configuration
RUN rm -v /etc/nginx/conf.d/default.conf

# Copy our built assets from the previous stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy a custom Nginx configuration into place.  This file should
# proxy API requests to the backend container and serve the static
# assets for all other routes.  The nginx.conf will be provided at
# runtime via docker‑compose.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80 for HTTP traffic
EXPOSE 80

# Start Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]