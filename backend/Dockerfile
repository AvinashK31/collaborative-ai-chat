##
## Dockerfile for the NestJS backend of the Collaborative AI Chat
##
## This multi‑stage build installs dependencies, compiles the
## TypeScript source into JavaScript, and produces a lean runtime
## image for production.  It honours environment variables for
## connecting to MySQL, the vector database and the OpenAI API.  You
## can override defaults at runtime via docker‑compose or CLI.

# Stage 1: build the application
FROM node:18 AS build

WORKDIR /app

# Copy package descriptors and lock file first to leverage Docker cache
COPY package.json ./

# Install all dependencies (including dev dependencies for building)
RUN yarn install

# Copy the rest of the source code
COPY . .

# Build the project (transpile TypeScript to JavaScript in dist/)
RUN yarn run build

# Generate Prisma client
RUN yarn prisma generate

# Stage 2: create a minimal production image
FROM node:18 AS production

WORKDIR /app

# Copy the entire source for Prisma generation
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json

# Install only production dependencies
RUN yarn install --frozen-lockfile --production

# Generate Prisma client in production stage
RUN yarn prisma generate

# Copy the built output
COPY --from=build /app/dist ./dist

# Install netcat for database connectivity test
RUN apt-get update && apt-get install -y netcat-openbsd && rm -rf /var/lib/apt/lists/*

# Create a startup script that waits for database and runs migrations
RUN echo '#!/bin/bash\n\
echo "Waiting for database to be ready..."\n\
while ! nc -z db 3306; do\n\
  echo "Database not ready, waiting..."\n\
  sleep 2\n\
done\n\
echo "Database is ready!"\n\
echo "Running Prisma migrations..."\n\
yarn prisma migrate deploy\n\
echo "Starting NestJS application..."\n\
exec node dist/src/main.js' > /app/start.sh && chmod +x /app/start.sh

# Expose the backend port
EXPOSE 9000

# Start the NestJS application with migrations
CMD ["/app/start.sh"]