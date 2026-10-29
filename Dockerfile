FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY apps/server/package.json apps/server/package.json
COPY packages/game-core/package.json packages/game-core/package.json
COPY packages/networking/package.json packages/networking/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm install
COPY apps/server apps/server
COPY packages packages
RUN npm run build --workspace=@the-last-diya/server

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787
COPY package.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/server/src apps/server/src
COPY packages packages
RUN npm install --workspace=@the-last-diya/server --include-workspace-root=false
RUN npm cache clean --force
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:8787/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["npm", "start", "--workspace=@the-last-diya/server"]
