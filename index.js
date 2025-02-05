import "dotenv/config";
// import { Telegraf } from "telegraf";
import { initTG, createDataToSend, sendFirstMessage } from "./modules/telegram_connect.js";
import { filterRequest, lastYaFilesAdded } from "./modules/ya_request.js";
import { readSettingFile, rewriteSettingFile } from "./modules/json_rewrite.js";
// import { setInterval } from "timers/promises";
import { setInterval } from "timers";
// import { get } from "http";
// import { resolve } from "path";
// import https from "https";
const limitLastItems = 30; //Лимит количества последних файлов в запросе
const scanInterval = 1; //Интервал сканирования в мин
let firstCheck = true; // Флаг первого прохода
let lastFile = ""; // Последний обработанный файл
let requestData = {}; // Данные последнего запроса

// const photoData = [
//   {
//     type: "photo",
//     media:
//       "https://downloader.disk.yandex.ru/disk/97da0889376e27528c1cb0419756fa6fd43136352e8e404226b8536867508aed/676c1aa1/tBOvAmC222cQ56OOSPFv62i0-EcV7mV2_yLMP5l32XxJ2_fKed5y53BHAVwqbTrK30YTJKnKYqTxVY5SpRdpcA%3D%3D?uid=52099234&filename=1734990655325.jpg&disposition=attachment&hash=&limit=0&content_type=image%2Fjpeg&owner_uid=52099234&fsize=5007813&hid=4020d7d594a6cd21fb4f856c47a12a8b&media_type=image&tknv=v2&etag=2c4e67f60e717a8d687ca6b3ca465284",
//   },
//   {
//     type: "photo",
//     media:
//       "https://downloader.disk.yandex.ru/disk/9222c6d5d9e4bcce7debf15812bc8b049b1c66e3908d3ae61a619e1de186bb3f/676c1aa1/tBOvAmC222cQ56OOSPFv661y9NsWVhv7mxoNSQiij00m8_HfvJtOOLVsyhgwU4OhcyGMrMUpcEttqrN5nMFJdw%3D%3D?uid=52099234&filename=1734990655342.jpg&disposition=attachment&hash=&limit=0&content_type=image%2Fjpeg&owner_uid=52099234&fsize=4670246&hid=eeba6ca9bd114d31b49484393849e8e2&media_type=image&tknv=v2&etag=2caf42b945c98ef8007e28f0d28bd0db",
//   },
//   {
//     type: "photo",
//     media:
//       "https://downloader.disk.yandex.ru/disk/a8d33c0f5c03987285f8d462550fc4d4bfa22f5d4148f845e2a00b137e4f210d/676c1aa1/tBOvAmC222cQ56OOSPFv62t7GNKjTgdWl-W0fKcQJgwMa3YnGu7SoMoZi0CCjkyMPIX36UQsrrLqM-k_qF4MJA%3D%3D?uid=52099234&filename=1734990655357.jpg&disposition=attachment&hash=&limit=0&content_type=image%2Fjpeg&owner_uid=52099234&fsize=4885773&hid=5065c296569b17d6c6112bfb5e2fb399&media_type=image&tknv=v2&etag=cf7d34c2926a27be484d5bf9057d4cf2",
//   },
//   {
//     type: "photo",
//     media:
//       "https://downloader.disk.yandex.ru/disk/a643f25b4ee11bc51caee3188d930684c96e45951acea2cb67869b9f3a910518/676c1aa1/tBOvAmC222cQ56OOSPFv6-ExNyHu_HU5W9l3Vl8BmkOgmI6K6MOl4u4sqGv98vS5MEfx-QM6-vaiCy-W_xfEog%3D%3D?uid=52099234&filename=1734990655366.jpg&disposition=attachment&hash=&limit=0&content_type=image%2Fjpeg&owner_uid=52099234&fsize=5619545&hid=49ce32d5a22b86ec19bd8cf7d8929877&media_type=image&tknv=v2&etag=8b0e9f4b6d057d5d978e4dd5e8c5c1fe",
//   },
//   {
//     type: "photo",
//     media:
//       "https://downloader.disk.yandex.ru/disk/fd326df69b498495dc42b2ab10e3bd675ef892bdd56879884db6380f05e68c1c/676c1aa1/tBOvAmC222cQ56OOSPFv6_TWdLZt3SNFEo5cAFJR4_uCOvbQDmnD7KyV5Gj1A6cjr1hJ9qR22SXupxxfFYOU8Q%3D%3D?uid=52099234&filename=1733947664894.jpg&disposition=attachment&hash=&limit=0&content_type=image%2Fjpeg&owner_uid=52099234&fsize=2282387&hid=1f341c092549a588fc3f748a1785e5aa&media_type=image&tknv=v2&etag=7610ca4170d15db456dd9142f61e109d",
//   },
//   {
//     type: "photo",
//     media:
//       "https://downloader.disk.yandex.ru/disk/d5032042a4c004132977b9af96ee2faf8cf4888146b04708ccdf4b4dfd8a5844/676c1aa1/tBOvAmC222cQ56OOSPFv64WQPKSiDN1rNOzQzosIoqPjC3vh5LnRCVSe2QRyBVcoBilLQcMPt6DtZi38L67U9w%3D%3D?uid=52099234&filename=1733947664909.jpg&disposition=attachment&hash=&limit=0&content_type=image%2Fjpeg&owner_uid=52099234&fsize=5584238&hid=ca4295358e038bb6dcb1db23112b5379&media_type=image&tknv=v2&etag=392ff96a4ad57f88438dcd78bf953750",
//   },
//   {
//     type: "photo",
//     media:
//       "https://downloader.disk.yandex.ru/disk/7bd7ca29f01bddf67887045ce75f5f0406a931057ff60d744eab38eb9e852613/676c1aa1/tBOvAmC222cQ56OOSPFv6_fhfKp5o1difKTgD6-VkqM3PUFnfkrLHAdvDzrE3KfigOpISOEt1qVHG_grrlshcg%3D%3D?uid=52099234&filename=1733947664922.jpg&disposition=attachment&hash=&limit=0&content_type=image%2Fjpeg&owner_uid=52099234&fsize=5855485&hid=341f68b049b12a9630a856b28e0bdfe3&media_type=image&tknv=v2&etag=02803fc17ee8aa9aac4746172222a49c",
//   },
//   {
//     type: "photo",
//     media:
//       "https://downloader.disk.yandex.ru/disk/96809df1d83e8690b5ae2ea74e6fdde3345672673e17dff06aaf843b5a8b7c63/676c1aa1/tBOvAmC222cQ56OOSPFv61xhaqOzuvRH7_yfcgCBB093uZOsy0GtsVNHMp2E8kWS6B7rnjcYn23nYzcv2Jhjag%3D%3D?uid=52099234&filename=1733947664935.jpg&disposition=attachment&hash=&limit=0&content_type=image%2Fjpeg&owner_uid=52099234&fsize=3356354&hid=c3c4a5ba8a2ae6ac16499498e19b4e80&media_type=image&tknv=v2&etag=82dc9117e719d86ff8207030fa313321",
//   },
//   {
//     type: "photo",
//     media:
//       "https://downloader.disk.yandex.ru/disk/7adffee029f5d094e3be8a566f6311dfae47920b3ceed4fd043fd194920759dc/676c1aa1/tBOvAmC222cQ56OOSPFv6xe0H1h1jmc2H8l4WZU6DaaXr6CaAG8DR6yKdTOnMtHVRIFzHqcw1TALItnNVCNceA%3D%3D?uid=52099234&filename=1733947664948.jpg&disposition=attachment&hash=&limit=0&content_type=image%2Fjpeg&owner_uid=52099234&fsize=3343311&hid=9f80fb522ed6dff1e5767f77efb1bb01&media_type=image&tknv=v2&etag=c5d944f376e77d45d4e3f57a8f156dcd",
//   },
//   {
//     type: "photo",
//     media:
//       "https://downloader.disk.yandex.ru/disk/3b39222f399a527321784ff87cd702162af1d242216c1262ec594f9c59c3aacb/676c1aa1/tBOvAmC222cQ56OOSPFv61l2HlfFTdACUU4oOUlYN8dqWco6dAQgMztmxpoebY5oinGTIURXD5M0TR1UYpoprw%3D%3D?uid=52099234&filename=1733947664960.jpg&disposition=attachment&hash=&limit=0&content_type=image%2Fjpeg&owner_uid=52099234&fsize=3630372&hid=5724c069556adbb88cf9e7673cd564d7&media_type=image&tknv=v2&etag=710b1db0565a2513553aa6008997e86e",
//   },
// ];

// Инициализация Telegram-бота
initTG();

startScanDisk();
// sendDataToTg(photoData);

// Основная функция для периодического сканирования Яндекс.Диска
function startScanDisk() {
  setInterval(() => {
    // startScanDisk();
    lastYaFilesAdded(limitLastItems).then((obj) => checkArr(obj));
  }, 10000);
}

// Проверяет массив новых файлов и определяет, есть ли обновления
async function checkArr(newData) {
  if (firstCheck) {
    // Если это первый проход, проверяем, изменился ли последний файл с последней проверки
    if (newData.items[0].name !== readSettingFile().lastFile) {
      lastFile = newData.items[0].name;
      firstCheck = false;
      console.log("1st lap");

      // Запускаем второй проход через 1 секунду
      setTimeout(() => {
        console.log("timeOut");
        lastYaFilesAdded(limitLastItems).then((obj) => checkArr(obj));
      }, 1000);
    } else {
      console.log("no change");
    }
  } else {
    // Проверка второго и последующих проходов(в случае процесса загрузки новых файлов на диск)
    console.log("next lap");
    if (newData.items[0].name !== lastFile) {
      lastFile = newData.items[0].name;

      setTimeout(() => {
        lastYaFilesAdded(limitLastItems).then((obj) => checkArr(obj));
      }, 1000);
    } else {
      requestData.lastUpdate = Date.now();
      requestData.lastFile = newData.items[0].name;

      // Фильтруем файлы, оставляя только новые (по дате последнего обновления)
      const filtredObj = filterRequest(newData, readSettingFile().lastUpdate);

      if (filtredObj.image.length + filtredObj.video.length + filtredObj.invalid.length > 0) {
        createTgDataObject(filtredObj); // Отправляем новые файлы в Telegram
      }
      // rewriteSettingFile(requestData); // Записываем обновленные данные в файл json
      resetToDefault(); // Сбрасываем параметры
    }
  }
}

// Создает объект данных для отправки в Telegram
function createTgDataObject(data) {
  sendFirstMessage();
  for (let key in data) {
    createDataToSend(data[key], key);
  }
}

// Сброс переменных в исходное состояние
function resetToDefault() {
  firstCheck = true;
  lastFile = "";
  requestData = {};
}
