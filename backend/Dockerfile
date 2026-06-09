FROM node:20-alpine

# Set environment variable
ENV NODE_ENV=production

WORKDIR /app

# Copy dependency definition files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy source code files
COPY . .

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Expose backend port
EXPOSE 9000

# Start command
CMD ["node", "index.js"]
