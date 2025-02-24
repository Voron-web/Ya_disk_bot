import { Telegraf } from "telegraf";
import { getFile } from "./ya_request.js";
import "dotenv/config";

const bot = new Telegraf(process.env.BOT_TOKEN);
const chat_id = 1389757454;

// Инициализация и запуск бота
export function initTG() {
  //   bot.start((ctx) => {
  //     ctx.reply("Hi!");
  //     console.log(ctx.chat);
  //   });

  bot.launch();
}

export function createDataToSend(data, type) {
  Promise.all(
    data.map(async (element) => {
      // Присвоение типа отправляемых данных
      let typeFile;
      if (type == "image") {
        typeFile = "photo";
      } else if (type == "video") {
        typeFile = "video";
      } else if (type == "invalid") {
        typeFile = "invalid";
      }
      // else if (type == "documents") {
      //   typeFile = "document";
      // }

      // Получаем ссылку на файл
      const val = await getFile(encodeURIComponent(element.path.split(":")[1]));
      return {
        type: typeFile,
        media: val,
      };
    })
  ).then((array) => {
    // фильтрация форматов (из-за Telegram-ограничений на групповые отправки) !отключена
    if (array.length !== 0) {
      // let filteredArray;
      // if (type == "image") {
      //   filteredArray = array.filter((element) => {
      //     return /type=image\%2Fjpeg/.test(element.media);
      //   });
      // } else if (type == "video") {
      //   filteredArray = array.filter((element) => {
      //     return /type=video\%2F(mp4|mov|avi|mkv|webm|mpeg|3gp|flv)/.test(element.media);
      //   });
      // } else filteredArray = array;

      // const filteredArray = array.filter((element) => {
      //   console.log(type);
      //   if (type == "image") {
      //     // console.log(/type=image\%2Fjpeg/.test(element.media));
      //     return /type=image\%2Fjpeg/.test(element.media);
      //   } else if (type == "video") {
      //     return element.media.match(/type=video\%2F(mp4|mov|avi|mkv|webm|mpeg|3gp|flv)/);
      //   }
      // });

      // разбивка на блоки по 10 элементов (ограничение sendMediaGroup)
      let arrayBlocksElement = [];
      for (let i = 0; i < array.length; i += 10) {
        arrayBlocksElement.push(array.slice(i, i + 10));
      }
      // console.log(arrayBlocksElement);

      //отправка каждого блока в чат
      arrayBlocksElement.forEach((block) => {
        sendDataToTg(block);
      });
    }
  });
}

//Отправка контента
function sendDataToTg(data) {
  if (data[0].type != "invalid") {
    bot.telegram.sendMediaGroup(chat_id, JSON.stringify(data));
  }
}

export function sendFirstMessage(message) {
  bot.telegram.sendMessage(chat_id, message, { parse_mode: "HTML" });
}
