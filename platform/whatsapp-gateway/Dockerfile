FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 make g++ git ca-certificates && \
  rm -rf /var/lib/apt/lists/*

RUN git config --global url."https://github.com/".insteadOf ssh://git@github.com/

WORKDIR /app

COPY package.json ./
RUN npm install --production=false

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

RUN npm prune --production

RUN mkdir -p /data

VOLUME /data

EXPOSE 3001

CMD ["node", "dist/index.js"]
