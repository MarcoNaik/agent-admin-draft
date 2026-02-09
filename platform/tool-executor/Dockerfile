FROM node:20-slim

WORKDIR /app

COPY package.json ./
RUN npm install --production=false

COPY tsconfig.json ./
COPY src ./src

RUN npm run build
RUN npm prune --production

EXPOSE 3002

CMD ["node", "dist/index.js"]
