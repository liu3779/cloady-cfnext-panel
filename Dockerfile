FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY worker.js server.js ./
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
