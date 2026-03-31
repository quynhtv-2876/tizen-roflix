# Stage 1: builder - install dependencies
FROM node:22-slim AS builder

# Set working directory and copy package files first to leverage Docker layer cache
WORKDIR /app
COPY package*.json ./

# Set production environment
ENV NODE_ENV=production

# Install dependencies. If package-lock.json is present, use npm ci for reproducible installs
# omit dev dependencies to keep production image small
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# Copy source code (exclude files via .dockerignore)
COPY . .


# Stage 2: runtime
# Use a Node runtime image to ensure `node` is available
FROM node:22-slim AS runtime

# Install minimal required packages for Puppeteer/Chromium
RUN apt-get update \
        && apt-get install -y --no-install-recommends \
                ca-certificates \
                fonts-liberation \
                libasound2 \
                libatk-bridge2.0-0 \
                libatk1.0-0 \
                libc6 \
                libcairo2 \
                libcups2 \
                libdbus-1-3 \
                libexpat1 \
                libfontconfig1 \
                libgbm1 \
                libgcc1 \
                libglib2.0-0 \
                libgtk-3-0 \
                libnspr4 \
                libnss3 \
                libpango-1.0-0 \
                libpangocairo-1.0-0 \
                libstdc++6 \
                libx11-6 \
                libx11-xcb1 \
                libxcb1 \
                libxcomposite1 \
                libxcursor1 \
                libxdamage1 \
                libxext6 \
                libxfixes3 \
                libxi6 \
                libxrandr2 \
                libxrender1 \
                libxss1 \
                libxtst6 \
                lsb-release \
                wget \
                xdg-utils \
                chromium \
        && rm -rf /var/lib/apt/lists/*

# Create an unprivileged user to run the app
RUN groupadd -r app && useradd -r -g app -m -d /home/app app

WORKDIR /app

# Copy built app (including node_modules) from builder
COPY --from=builder /app .

# Give ownership to the non-root user
RUN chown -R app:app /app

# Switch to non-root user
USER app

# Ensure runtime is production
ENV NODE_ENV=production

# Expose the app port
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
        CMD node ./healthcheck.js || exit 1

# Start the server
CMD ["npm", "start"]

