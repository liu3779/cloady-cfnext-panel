FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY worker.js backend.js server.js patch-backend.mjs ./
# Apply the container patch to the backend (removes the http->https redirect;
# TLS is terminated at the Cloady edge). Fails the build if upstream changes.
RUN node patch-backend.mjs
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
