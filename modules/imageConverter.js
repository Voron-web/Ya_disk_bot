import sharp from "sharp";
import { downloadFile } from "./services.js";
import fs from "fs";
import path from "path";
import convert from "heic-convert";

export async function convertInvalidImage(link) {
	let filePath = await downloadFile(link);
	const fileName = path.basename(link, path.extname(link));

	if (/.heic$/i.test(filePath)) {
		const buffer = fs.readFileSync(filePath);
		filePath = await convertHeic(buffer, fileName);
	}
	const convertedFilePath = await convertToJpeg(filePath);
	console.log(convertedFilePath);

	return convertedFilePath;

	// TODO: add HEIC format converter
}

async function convertToJpeg(inputPath, outputDir = "./downloads/converted") {
	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
	}

	try {
		const fileName = path.basename(inputPath, path.extname(inputPath));
		const outputPath = path.join(outputDir, `${fileName}.jpg`);
		console.log("Convert", inputPath);

		let quality = 90;
		const maxSize = 5 * 1024 * 1024; //5 mb
		let data = await convertProcess(inputPath, quality);

		while (data.length > maxSize && quality > 10) {
			quality -= 10;
			data = await convertProcess(inputPath, quality);
		}
		fs.writeFileSync(outputPath, data);

		return outputPath;
	} catch (error) {
		console.error("Error convert image file:", error);
	}
}

async function convertProcess(inputPath, quality) {
	const data = await sharp(inputPath)
		.resize({ width: 1024, height: 1024, fit: "inside" })
		.jpeg({
			quality: quality,
		})
		.toBuffer();
	return data;
}

async function convertHeic(buffer, fileName, outputPath = "./downloads") {
	try {
		const outputBuffer = await convert({
			buffer: buffer,
			format: "JPEG",
			quality: 1,
		});
		const fullPath = path.join(outputPath, `${fileName}.jpg`);
		fs.writeFileSync(fullPath, outputBuffer);
		return fullPath;
	} catch (error) {
		console.error("Error convert HEIC file:", error);
		throw error;
	}
}
