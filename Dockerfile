FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY packages/game-core/package.json packages/game-core/package.json
COPY packages/networking/package.json packages/networking/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci
COPY apps/server apps/server
COPY packages packages
RUN npm run build --workspace=@the-last-diya/server

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/apps/server/package.json apps/server/package.json
COPY --from=build /app/apps/server/dist apps/server/dist
COPY --from=build /app/packages packages
RUN npm ci --omit=dev --workspace=@the-last-diya/server --include-workspace-root=false
USER node
EXPOSE 8787
CMD ["node", "apps/server/dist/index.js"]
