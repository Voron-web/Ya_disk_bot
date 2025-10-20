import { Telegraf } from "telegraf";
import { getFile, getFolderLink } from "./ya_request.js";
import { convertInvalidVideo } from "./video_converter.js";
import fs from "fs";
import { convertInvalidImage } from "./imageConverter.js";

console.log(process.env.BOT_TOKEN);

const bot = new Telegraf(process.env.BOT_TOKEN);
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
		await Promise.all(
			data[key]
				.map(async (element) => {
					// Get file downloading link
					const fileLink = await getFile(encodeURIComponent(element.path.split(":")[1]));
					if (key === "photo" || key === "video") {
						return {
							type: key,
							media: fileLink,
						};
					} else if (key == "invalidVideos" || key == "invalidImages") {
						if (key == "invalidVideos") {
							const convertedFilePath = await convertInvalidVideo(fileLink);
							if (convertedFilePath) {
								return {
									type: "video",
									media: { source: fs.createReadStream(convertedFilePath) },
								};
							}
						} else {
							const convertedFilePath = await convertInvalidImage(fileLink);
							if (convertedFilePath) {
								return {
									type: "photo",
									media: { source: fs.createReadStream(convertedFilePath) },
								};
							}
						}
						// TODO: else if(type == "invalidImages"){}
					}
				})
				.filter(Boolean)
		).then(async (array) => {
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
		});
	}
	return tgObjectsArray;
}

// определение ночного времени во всех часовых поясах
function checkTime() {
	const dayStart = 9;
	const dayEnd = 22;
	const timeZones = [3, 4, 1]; //Часовые пояса Москва (+3), Тбилиси(+4), Мадрид(+1)
	const currentDate = new Date();
	const currentHourUTC = currentDate.getUTCHours();

	if (Math.min(...timeZones) + currentHourUTC >= dayStart && currentHourUTC + Math.max(...timeZones) < dayEnd) {
		return "day";
	} else {
		return "night";
	}
}

/**
 * Send files blocks to telegram chat
 *
 * @param {Array} dataBlocks - array of telegram data to send
 */

export async function sendDataToTg(dataBlocks) {
	const folderLink = await getFolderLink();
	sendFirstMessage(`На ЯндексДиск загружены новые медиа-файлы.\n Посмотреть <b><a href="${folderLink}">все файлы</a></b>`);

	for (const block of dataBlocks) {
		await new Promise((resolve) => setTimeout(resolve, 1000)); // Задержка перед отправкой

		try {
			await bot.telegram.sendMediaGroup(chat_id, block, { disable_notification: true });
			console.log(getTimeStamp(), "Медиа-группа отправлена.");
		} catch (error) {
			if (error.response && error.response.error_code === 429) {
				const retryAfter = error.response.parameters.retry_after;
				console.log(getTimeStamp(), `Слишком много запросов! Ждем ${retryAfter} секунд...`);
				await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
				await sendDataToTg([block]); // Повторяем отправку только этого блока
			} else {
				console.error(getTimeStamp(), "Ошибка отправки:", error.message);
			}
		}
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
