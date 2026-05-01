/**
 * Модуль вспомогательных сервисов (утилит).
 *
 * Содержит функции для:
 * - Скачивания медиафайлов (изображений и видео) по URL.
 * - Определения времени суток (день/ночь) с учетом различных часовых поясов.
 */
import axios from "axios";
import fs from "fs";
import path from "path";

// Скачивание файла по ссылке
export async function downloadFile(url, saveDir = "./downloads") {
	try {
		const response = await axios({
			method: "GET",
			url,
			responseType: "arraybuffer",
		});

		const mimeType = response.headers["content-type"];
		if (!mimeType || (!mimeType.startsWith("image/") && !mimeType.startsWith("video/"))) {
			console.log("⛔ Unsupported file type:", mimeType);
			return null;
		}

		const ext = mimeType.split(";")[0].split("/")[1];

		// create folder
		if (!fs.existsSync(saveDir)) {
			fs.mkdirSync(saveDir, { recursive: true });
		}

		const fileName = `${Date.now()}.${ext}`;
		const filePath = path.join(saveDir, fileName);

		// save file
		console.log("Скачивание файла ");
		fs.writeFileSync(filePath, response.data);

		console.log("Скачивание файла завершено ");

		return filePath;
	} catch (error) {
		console.error("❌ Ошибка при скачивании:", error.message);
		throw error;
	}
}

// определение ночного времени во всех часовых поясах
export function checkTime() {
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
