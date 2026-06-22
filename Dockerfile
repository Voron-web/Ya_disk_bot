# ВАЖНО: версия Node запинена намеренно. На Node 25+ ломается загрузка файлов
# через telegraf 4.16 (старый node-fetch v2) — запрос виснет 60с и рвётся (socket hang up).
# Не менять на node:slim без версии — он тянет свежий Node и всё снова отвалится.
FROM node:22-slim

RUN apt-get update && \
    apt-get install -y ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production

EXPOSE 3002

CMD ["npm","run","start"]