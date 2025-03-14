import "dotenv/config";
import { initTG, createDataToSend, sendFirstMessage } from "./modules/telegram_connect.js";
import { filterRequest, lastYaFilesAdded, getFolderLink } from "./modules/ya_request.js";
import { readSettingFile, rewriteSettingFile } from "./modules/json_rewrite.js";
import { setInterval } from "timers";
import winston from "winston";

const limitLastItems = 30; //Лимит количества последних файлов в запросе
const scanInterval = 10; //Интервал сканирования в мин
const awaitInterwal = 2; //Интервал между проходами в мин
let firstCheck = true; // Флаг первого прохода
let lastFile = ""; // Последний обработанный файл
let requestData = {}; // Данные последнего запроса

const logger = winston.createLogger({
	level: "error",
	format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
	transports: [new winston.transports.File({ filename: "error.log", level: "error" })],
});
export default logger;

// Инициализация Telegram-бота

initTG();

try {
	startScanDisk();
} catch (error) {
	logger.error({ message: error.message, stack: error.stack });
}

// Основная функция для периодического сканирования Яндекс.Диска
function startScanDisk() {
	setInterval(() => {
		lastYaFilesAdded(limitLastItems).then((obj) => checkArr(obj));
	}, scanInterval * 60000);
}

// Проверяет массив новых файлов и определяет, есть ли обновления
async function checkArr(newData) {
	if (firstCheck) {
		// Если это первый проход, проверяем, изменился ли последний файл с последней проверки
		if (newData.items[0].name !== readSettingFile().lastFile) {
			lastFile = newData.items[0].name;
			firstCheck = false;

			// Запускаем второй проход выждав интервал
			setTimeout(() => {
				console.log("timeOut");
				lastYaFilesAdded(limitLastItems).then((obj) => checkArr(obj));
			}, awaitInterwal * 60000);
		} else {
			console.log(Date.now().toString(), "No new data");
		}
	} else {
		// Проверка второго и последующих проходов(в случае процесса загрузки новых файлов на диск)
		console.log("New data find. Waiting...");
		if (newData.items[0].name !== lastFile) {
			lastFile = newData.items[0].name;

			setTimeout(() => {
				lastYaFilesAdded(limitLastItems).then((obj) => checkArr(obj));
			}, awaitInterwal * 60000);
		} else {
			requestData.lastUpdate = Date.now();
			requestData.lastFile = newData.items[0].name;

			// Фильтруем файлы, оставляя только новые (по дате последнего обновления)
			const filtredObj = filterRequest(newData, readSettingFile().lastUpdate);

			if (filtredObj.image.length + filtredObj.video.length + filtredObj.invalid.length > 0) {
				console.log("No new updates found. Send data to messenger");
				createTgDataObject(filtredObj); // Отправляем новые файлы в Telegram
			} else {
				console.log("All new files are invalid");
			}
			rewriteSettingFile(requestData); // Записываем обновленные данные в файл json
			resetToDefault(); // Сбрасываем параметры
		}
	}
}

// Создает объект данных для отправки в Telegram
function createTgDataObject(data) {
	getFolderLink().then((link) => {
		const textMessage = `На ЯндексДиск загружены новые медиа-файлы.\n Посмотреть <b><a href="${link}">все файлы</a></b>`;
		sendFirstMessage(textMessage);
		for (let key in data) {
			createDataToSend(data[key], key);
		}
	});
}

// Сброс переменных в исходное состояние
function resetToDefault() {
	firstCheck = true;
	lastFile = "";
	requestData = {};
}
