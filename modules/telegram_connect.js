import { Telegraf } from "telegraf";
import https from "https";
import { getFile, getFolderLink } from "./ya_request.js";
import { convertInvalidVideo } from "./video_converter.js";
import { convertInvalidImage } from "./imageConverter.js";
import { checkTime } from "./services.js";

console.log(process.env.NODE_ENV);
console.log(process.env.DOTENV_CONFIG_PATH);
console.log(process.env.BOT_TOKEN);

// family: 4 — жёстко используем IPv4: у сервера не работает IPv6 до api.telegram.org.
// keepAlive — переиспользуем соединения вместо нового хендшейка на каждый запрос/загрузку.
const tgAgent = new https.Agent({ keepAlive: true, family: 4 });

const bot = new Telegraf(process.env.BOT_TOKEN, { telegram: { agent: tgAgent } });
const chat_id = process.env.CHAT_ID; //получаем id чата, в который будут отправляться данные

// telegram bot initialization and start
export function initTG() {
	bot.launch();
	bot.start((ctx) => ctx.reply(ctx.message.chat.id));
}

/**
 * Create array included telegram objects
 *
 * @param {Object} data - separated object by type
 * @returns {Array}
 * @example
 * [
 *  [
 *   {
 *     type: "video",
 *     media: "ReadStream",
 *   }
 *  ],
 *  [
 *   {
 *     type: "image",
 *     media: 'https:yadisk.com...',
 *   },
 *   {
 *     type: "image",
 *     media: 'https:yadisk.com...'
 *   }
 *  ]
 * ]
 *
 */

export async function createDataToSend(data) {
	let tgObjectsArray = [];

	for (let key in data) {
		// Тяжёлые категории (скачивание + конвертация) обрабатываем последовательно,
		// чтобы не держать несколько больших файлов в памяти и не запускать несколько
		// процессов ffmpeg одновременно (иначе контейнер падает по OOM).
		const isHeavy = key === "invalidVideos" || key === "invalidImages";

		let array;
		if (isHeavy) {
			array = [];
			for (const element of data[key]) {
				array.push(await buildTgElement(key, element));
			}
		} else {
			// Лёгкие категории отправляются ссылкой без скачивания — можно параллельно
			array = await Promise.all(data[key].map((element) => buildTgElement(key, element)));
		}

		const filteredArray = array.filter(Boolean);
		if (filteredArray.length !== 0) {
			// divide array to blocks for sendMediaGroup directive (max 10 files & 50Mb for group)
			let blockLength = 10;
			if (key == "video" || key == "invalidVideos") {
				blockLength = 1;
			}

			for (let i = 0; i < filteredArray.length; i += blockLength) {
				const block = filteredArray.slice(i, i + blockLength);
				tgObjectsArray.push(block);
			}
		}
	}
	return tgObjectsArray;
}

/**
 * Build single telegram media object for the given file
 *
 * @param {string} key - category name (image | video | invalidVideos | invalidImages)
 * @param {Object} element - file descriptor from yaDisk response
 * @returns {Promise<Object|undefined>}
 */
async function buildTgElement(key, element) {
	// Get file downloading link
	const fileLink = await getFile(encodeURIComponent(element.path.split(":")[1]));
	if (key === "image" || key === "video") {
		return {
			type: key === "image" ? "photo" : key,
			media: fileLink,
		};
	} else if (key == "invalidVideos") {
		const fileName = element.path.split("/").pop();
		console.log(getTimeStamp(), `▶️ Начало обработки видео: ${fileName}`);
		const convertedFilePath = await convertInvalidVideo(fileLink);
		console.log(getTimeStamp(), `✅ Обработка видео завершена: ${fileName}`);
		if (convertedFilePath) {
			return {
				type: "video",
				// путь строкой, а не ReadStream: telegraf создаёт свежий поток на каждую попытку отправки
				media: { source: convertedFilePath },
			};
		}
	} else if (key == "invalidImages") {
		const fileName = element.path.split("/").pop();
		console.log(getTimeStamp(), `▶️ Начало обработки изображения: ${fileName}`);
		const convertedFilePath = await convertInvalidImage(fileLink);
		console.log(getTimeStamp(), `✅ Обработка изображения завершена: ${fileName}`);
		if (convertedFilePath) {
			return {
				type: "photo",
				// путь строкой, а не ReadStream: telegraf создаёт свежий поток на каждую попытку отправки
				media: { source: convertedFilePath },
			};
		}
	}
	return undefined;
}

/**
 * Send files blocks to telegram chat
 *
 * @param {Array} dataBlocks - array of telegram data to send
 */

export async function sendDataToTg(dataBlocks, isRetry = false) {
	if (!isRetry) {
		const folderLink = await getFolderLink();
		await sendFirstMessage(`На ЯндексДиск загружены новые медиа-файлы.\n Посмотреть <b><a href="${folderLink}">все файлы</a></b>`);
	}

	for (const block of dataBlocks) {
		await new Promise((resolve) => setTimeout(resolve, 1000)); // Задержка перед отправкой
		await sendBlockWithRetry(block);
	}
}

/**
 * Send single media block with retries for rate limits (429) and network errors (socket hang up).
 *
 * @param {Array} block - one telegram media group (1..10 elements)
 * @param {number} attempt - current network-retry attempt
 */
async function sendBlockWithRetry(block, attempt = 1) {
	const maxAttempts = 3;
	try {
		await bot.telegram.sendMediaGroup(chat_id, block, { disable_notification: true });
		console.log(getTimeStamp(), "Медиа-группа отправлена.");
	} catch (error) {
		// 429 — слишком много запросов: ждём столько, сколько просит Telegram, попытку не тратим
		if (error.response && error.response.error_code === 429) {
			const retryAfter = error.response.parameters.retry_after;
			console.log(getTimeStamp(), `Слишком много запросов! Ждем ${retryAfter} секунд...`);
			await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
			return sendBlockWithRetry(block, attempt);
		}

		// Сетевой обрыв (socket hang up, ECONNRESET, ETIMEDOUT и т.п.) — у таких ошибок нет error.response
		const isNetworkError = !error.response;
		if (isNetworkError && attempt < maxAttempts) {
			const delaySec = attempt * 5; // 5с, затем 10с
			console.log(getTimeStamp(), `Сетевая ошибка (${error.message}). Повтор ${attempt}/${maxAttempts - 1} через ${delaySec}с...`);
			await new Promise((resolve) => setTimeout(resolve, delaySec * 1000));
			return sendBlockWithRetry(block, attempt + 1);
		}

		console.error(getTimeStamp(), "Ошибка отправки:", error.message);
	}
}

export async function sendFirstMessage(message) {
	//В ночное время отправка без уведомления
	await bot.telegram.sendMessage(chat_id, message, { parse_mode: "HTML", disable_notification: `${checkTime() == "night" ? true : false}` });
}

export function getTimeStamp() {
	const currentDate = new Date();
	return currentDate.toString();
}
