FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv git ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/database packages/database
COPY apps/research-api apps/research-api
COPY apps/research-worker apps/research-worker
COPY apps/research-swarm apps/research-swarm
COPY swarm-skills swarm-skills
RUN pnpm install --frozen-lockfile --filter @triviality/research-api... --filter @triviality/research-worker...
RUN pnpm --filter @triviality/database build && pnpm --filter @triviality/research-api build && pnpm --filter @triviality/research-worker build
RUN python3 -m venv /opt/swarm && /opt/swarm/bin/pip install --no-cache-dir -r apps/research-swarm/requirements.txt
RUN /opt/swarm/bin/python apps/research-swarm/setup_runtime.py
COPY config config
RUN mkdir -p /app/.data/swarm-runs /app/.data/object-storage && chown -R node:node /app/.data
ENV SWARM_PYTHON=/opt/swarm/bin/python
USER node
CMD ["node", "apps/research-api/dist/server.js"]
