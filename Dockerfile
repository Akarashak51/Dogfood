FROM node:22-alpine

WORKDIR /app

# Copying the lockfile too and using `npm ci` (not `npm install`) makes
# the build reproducible: it installs exactly what package-lock.json
# pins, fails loudly if the two files disagree, and is faster because
# it skips dependency resolution.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY fixtures.json ./fixtures.json

ENV PORT=8080
EXPOSE 8080

# Basic container healthcheck: lets `docker compose ps` / `docker inspect`
# show "healthy" once the portal is actually accepting requests, not just
# once the process has started.
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||8080)+'/projects',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "src/server.js"]
