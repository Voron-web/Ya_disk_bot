import { Telegraf } from "telegraf";
import { getFile } from "./ya_request.js";
import "dotenv/config";

const bot = new Telegraf(process.env.BOT_TOKEN); //Получаем токен бота
const chat_id = process.env.CHAT_ID; //получаем id чата, в который будут отправляться данные

// Инициализация и запуск бота
export function initTG() {
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

			// Получаем ссылку на файл
			const val = await getFile(encodeURIComponent(element.path.split(":")[1]));
			return {
				type: typeFile,
				media: val,
			};
		})
	).then((array) => {
		if (array.length !== 0) {
			// разбивка на блоки по 10 элементов (ограничение sendMediaGroup)
			let arrayBlocksElement = [];
			for (let i = 0; i < array.length; i += 10) {
				arrayBlocksElement.push(array.slice(i, i + 10));
			}
			//отправка каждого блока в чат
			arrayBlocksElement.forEach((block) => {
				sendDataToTg(block);
			});
		}
	});
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

//Отправка контента
async function sendDataToTg(data) {
	// Отправляем контент без уведомления
	if (data[0].type != "invalid") {
		await bot.telegram.sendMediaGroup(chat_id, JSON.stringify(data), {
			disable_notification: true,
		});
	}
}

export async function sendFirstMessage(message) {
	//В ночное время отправка без уведомления
	await bot.telegram.sendMessage(chat_id, message, { parse_mode: "HTML", disable_notification: `${checkTime() == "night" ? true : false}` });
}
