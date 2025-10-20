import fs from "fs";
import axios from "axios";
import path from "path";
import Ffmpeg from "fluent-ffmpeg";
import { downloadFile } from "./services.js";

export async function convertInvalidVideo(link) {
	const filePath = await downloadFile(link);
	const convertedFilePath = await convertToMp4(filePath);
	console.log(convertedFilePath);
	return convertedFilePath;
}

// async function downloadFile(url, saveDir = "./downloads") {
// 	try {
// 		const response = await axios({
// 			method: "GET",
// 			url,
// 			responseType: "arraybuffer",
// 		});

// 		const mimeType = response.headers["content-type"];
// 		if (!mimeType || (!mimeType.startsWith("image/") && !mimeType.startsWith("video/"))) {
// 			console.log("⛔ Unsupported file type:", mimeType);
// 			return null;
// 		}

// 		const ext = mimeType.split(";")[0].split("/")[1];

// 		// create folder
// 		if (!fs.existsSync(saveDir)) {
// 			fs.mkdirSync(saveDir, { recursive: true });
// 		}

// 		const fileName = `${Date.now()}.${ext}`;
// 		const filePath = path.join(saveDir, fileName);

// 		// save file
// 		console.log("Скачивание файла ");
// 		fs.writeFileSync(filePath, response.data);

// 		console.log("Скачивание файла завершено ");

// 		return filePath;
// 	} catch (error) {
// 		console.error("❌ Ошибка при скачивании:", error.message);
// 	}
// }

async function convertToMp4(inputPath, outputDir = "./downloads/converted") {
	return new Promise((resolve, reject) => {
		if (!fs.existsSync(inputPath)) return reject("Файл не найден");

		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}

		const baseName = path.basename(inputPath, path.extname(inputPath));
		const outputPath = path.join(outputDir, `${baseName}.mp4`);

		Ffmpeg.ffprobe(inputPath, (err, metadata) => {
			if (err) return reject(err);

			const duration = metadata.format.duration; // секунды
			if (!duration) return reject("Не удалось определить длительность");

			const maxSizeMB = 45;
			const bitrate = Math.floor((maxSizeMB * 8 * 1024) / duration); // кбит/с

			Ffmpeg(inputPath)
				.videoCodec("libx264")
				.audioCodec("aac")
				.videoBitrate(`${bitrate}k`)
				.outputOptions("-movflags +faststart")
				.format("mp4")
				.on("end", () => {
					const size = fs.statSync(outputPath).size / (1024 * 1024);
					console.log(`✅ Готово (${size.toFixed(2)} МБ)`);
					resolve(outputPath);
				})
				.on("error", (err) => {
					console.error("❌ Ошибка при конвертации:", err.message);
					reject(err);
				})
				.save(outputPath);
		});
	});
}
