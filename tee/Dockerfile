# Use a base image compatible with ROFL TEE containers
FROM node:20-alpine

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++ sqlite

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json yarn.lock* ./

# Install dependencies including tsx for running TypeScript
RUN yarn add -D tsx && yarn install --frozen-lockfile

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Set environment variables
ENV PORT=3000
ENV DB_PATH=/root/.my-volume/database.db
ENV NODE_ENV=production

# Start the server using tsx to run TypeScript directly
CMD ["yarn", "tsx", "src/start.ts"]

