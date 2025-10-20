import axios from "axios";
import fs from "fs";
import path from "path";

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
	}
}
