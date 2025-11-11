FROM node:slim

RUN apt-get update && \
    apt-get install -y handbrake-cli && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm i

COPY . .

ENV NODE_ENV=development

EXPOSE 3002

CMD ["npm","run","dev_docker"]
