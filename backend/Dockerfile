FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

COPY src ./src
COPY migrations ./migrations
COPY prisma.config.ts ./

ENV NODE_ENV=production
ENV API_SERVER_PORT=8000
ENV DOCKER_SOCKET_PATH=/var/run/docker.sock

EXPOSE 8000

CMD ["bun", "run", "src/index.ts"]
