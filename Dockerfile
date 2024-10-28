FROM node:23-alpine

COPY . /app
WORKDIR /app

RUN npm install
ENTRYPOINT ["node", "index.js"]
