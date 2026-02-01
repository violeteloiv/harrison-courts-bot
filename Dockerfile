# Base Node image
FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/bot

# Copy package.json first for caching
COPY package*.json ./

# Install dependencies (use production deps if NODE_ENV=production)
ARG NODE_ENV=development
ENV NODE_ENV=$NODE_ENV
RUN if [ "$NODE_ENV" = "production" ]; then npm install --omit=dev; else npm install; fi

# Copy source code
COPY . .

# Build the bot (TypeScript or similar)
RUN npm run build

# Default command (can be overridden in docker-compose)
CMD ["node", "dist/index.js"]
