import fs from "fs";
import path from "path";
import hbjs from "handbrake-js";
import { downloadFile } from "./services.js";

export async function convertInvalidVideo(link) {
	const filePath = await downloadFile(link);
	const convertedFilePath = await convertToMp4(filePath);
	console.log(convertedFilePath);
	return convertedFilePath;
}

async function convertToMp4(inputPath, outputDir = "./downloads/converted") {
	if (!fs.existsSync(inputPath)) throw new Error("Файл не найден");

	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
	}

	const baseName = path.basename(inputPath, path.extname(inputPath));
	const outputPath = path.join(outputDir, `${baseName}.mp4`);

	const convertOptions = {
		input: inputPath,
		output: outputPath,
		maxHeight: 640,
		maxWidth: 640,
		vb: 3000,
		optimize: true,
		encoder: "x264",
	};

	return await convertProcess(convertOptions);
}

function convertProcess(options) {
	return new Promise((resolve, reject) => {
		if (options.vb <= 0) {
			return reject(new Error("The video is to large  to convert")); 
		}
		hbjs
			.spawn(options)
			.on("complete", () => {
				console.log("Conversion done!");
				//check converted file size
				const fileSize = fs.statSync(options.output).size / 1024 / 1024;
				if (fileSize > 45) {
					console.log("The file size is to large. Repeat convert");
					const newOptions = { ...options, vb: options.vb - 500 };
					resolve(convertProcess(newOptions));
				} else {
					resolve(options.output);
				}
			})
			.on("error", (err) => {
				console.error("Error:", err);
				reject(err);
			});
	});
}
