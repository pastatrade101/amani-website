# syntax=docker/dockerfile:1
# Build the API from the monorepo root: docker build -t amani-api .
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json
RUN npm ci --workspace @amani/backend --include-workspace-root=false
COPY apps/backend/tsconfig.json ./apps/backend/tsconfig.json
COPY apps/backend/src ./apps/backend/src
RUN npm run build:backend

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=5000
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json
RUN npm ci --omit=dev --workspace @amani/backend --include-workspace-root=false && npm cache clean --force
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
WORKDIR /app/apps/backend
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
USER node
CMD ["node", "dist/server.js"]
