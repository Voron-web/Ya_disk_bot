import { initTG, createDataToSend, getTimeStamp, sendDataToTg } from "./modules/telegram_connect.js";
import { filterRequest, lastYaFilesAdded } from "./modules/ya_request.js";
import { readSettingFile, rewriteSettingFile } from "./modules/json_rewrite.js";
import { setInterval } from "timers";
import winston from "winston";
import fs from "fs";

const limitLastItems = 100; //Лимит количества последних файлов в запросе
const scanInterval = 10; //Интервал сканирования в мин (def: 10)
const awaitInterwal = 2; //Интервал между проходами в мин (def: 2)
let firstCheck = true; // Флаг первого прохода
let lastFile = ""; // Последний обработанный файл
let requestData = {}; // Данные последнего запроса
let cicleIsFinished = true; //Флаг завершения цикла

const logger = winston.createLogger({
	level: "error",
	format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
	transports: [new winston.transports.File({ filename: "error.log", level: "error" })],
});
export default logger;

// Telegram-bot initialization

initTG();

try {
	startScanDisk();
} catch (error) {
	logger.error({ message: error.message, stack: error.stack });
}

/**
 * Main cycle
 *
 */
function startScanDisk() {
	console.log(getTimeStamp(), "Start scan disc");

	const scan = async () => {
		if (cicleIsFinished) {
			cicleIsFinished = false;
			await lastYaFilesAdded(limitLastItems).then((obj) => checkArr(obj));
		}
	};

	scan(); // Запускаем первое сканирование сразу
	setInterval(scan, scanInterval * 60000);
}

/**
 * Main function to check not sended files and send it
 * @param {Object} newData - object from yaDisk response
 */
async function checkArr(newData) {
	if ("items" in newData) {
		if (firstCheck) {
			// Если это первый проход, проверяем, изменился ли последний файл с последней проверки
			if (newData.items[0].name !== readSettingFile().lastFile) {
				lastFile = newData.items[0].name;
				firstCheck = false;
				console.log(getTimeStamp(), "New data find. Waiting...");
				// Start second iterration after delay
				setTimeout(() => {
					lastYaFilesAdded(limitLastItems).then((obj) => checkArr(obj));
				}, awaitInterwal * 60000);
			} else {
				resetToDefault();
				console.log(getTimeStamp(), "No new data");
			}
		} else {
			// Проверка второго и последующих проходов(в случае процесса загрузки новых файлов на диск)
			if (newData.items[0].name !== lastFile) {
				lastFile = newData.items[0].name;
				console.log(getTimeStamp(), "New data find. Waiting...");
				setTimeout(() => {
					lastYaFilesAdded(limitLastItems).then((obj) => checkArr(obj));
				}, awaitInterwal * 60000);
			} else {
				requestData.lastUpdate = Date.now();
				requestData.lastFile = newData.items[0].name;

				// Фильтруем файлы, оставляя только новые (по дате последнего обновления)
				const filtredObj = filterRequest(newData, readSettingFile().lastUpdate);

				if (filtredObj.image.length + filtredObj.video.length + filtredObj.invalidImages.length + filtredObj.invalidVideos.length > 0) {
					console.log(getTimeStamp(), "New updates found. Send data to messenger");
					// Create array with telegram objects
					const tgObjectsArray = await createDataToSend(filtredObj);
					// Send files to chat
					await sendDataToTg(tgObjectsArray);
				} else {
					console.log(getTimeStamp(), "No new updates found");
				}
				rewriteSettingFile(requestData); // Записываем обновленные данные в файл json
				resetToDefault(); // Сбрасываем параметры
			}
		}
	} else {
		console.log(getTimeStamp(), "Ошибка запроса к ЯндксДиску");
		resetToDefault();
	}
}

// Сброс переменных в исходное состояние
function resetToDefault() {
	clearFolder("./downloads");
	firstCheck = true;
	lastFile = "";
	requestData = {};
	cicleIsFinished = true;
}

function clearFolder(path) {
	if (fs.existsSync(path)) {
		if (fs.readdirSync(path).length > 0) {
			fs.rmSync(path, { recursive: true, force: true });
		} else return;
	}
	fs.mkdirSync(path, { recursive: true });
}
