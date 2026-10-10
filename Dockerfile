# ==========================================
# Stage 1: Build the TypeScript application
# ==========================================
FROM node:22-alpine AS builder

# Set working directory inside container
WORKDIR /app

# Copy dependency manifests first to leverage Docker layer caching
COPY package*.json ./

# Install all dependencies (including TypeScript)
RUN npm ci

# Copy TypeScript config and source code
COPY tsconfig.json ./
COPY src ./src

# Compile TypeScript to JavaScript (outputs to /app/dist)
RUN npm run build

# ==========================================
# Stage 2: Lean Production Runtime
# ==========================================
FROM node:22-alpine AS runner

WORKDIR /app

# Set default production environment
ENV NODE_ENV=production

# Copy dependency manifests
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy compiled JavaScript output from builder stage
COPY --from=builder /app/dist ./dist
COPY migrations ./migrations

# Run as non-root user provided by node image for security
USER node

# Expose the default container port
EXPOSE 3000

# Start the application
CMD ["node", "dist/server.js"]
