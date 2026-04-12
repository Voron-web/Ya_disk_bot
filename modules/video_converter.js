import fs from "fs";
import path from "path";
// import hbjs from "handbrake-js";
import { downloadFile } from "./services.js";
import { spawn } from "child_process";

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

	const bitrate = Number(await calculateBitrate(inputPath));

	const convertOptions = {
		"-i": inputPath,
		"-vf": "scale='if(gt(a,1),640,-1)':'if(lt(a,1),640,-1)'",
		"-c:a": "copy",
		"-c:v": "libx264",
		"-b:v": "0",
		"-maxrate": bitrate,
		"-bufsize": bitrate * 2,
		"-preset": "veryfast",
		"-loglevel": "error",
		"-threads": 1,
		output: outputPath,
	};

	return await convertProcess(convertOptions, bitrate, 0);
}

async function convertProcess(options, baseBitrate, count) {
	console.log(baseBitrate);

	const minBitrate = 200000;
	const newCount = count + 1;

	const ffmpegOptions = { ...options };
	ffmpegOptions["-maxrate"] = baseBitrate - baseBitrate * 0.1 * count;
	ffmpegOptions["-bufsize"] = ffmpegOptions["-maxrate"] * 2;

	if (count > 10 || ffmpegOptions["-maxrate"] < minBitrate) {
		console.log("Can not convert this file. File is to large");
		return null;
	}

	const optionsArray = [];
	for (const key in ffmpegOptions) {
		if (key !== "output") {
			optionsArray.push(key);
			optionsArray.push(ffmpegOptions[key].toString());
		} else {
			optionsArray.push(ffmpegOptions[key].toString());
		}
	}

	return new Promise((resolve, reject) => {
		const ffmpeg = spawn("ffmpeg", optionsArray);

		ffmpeg.stderr.on("data", (data) => console.error("ffmpeg:", data.toString()));

		ffmpeg.on("close", (code) => {
			if (code === 0) {
				const fileSize = fs.statSync(options.output).size / 1024 / 1024;
				if (fileSize > 45) {
					console.log("The file size is to large. Repeat convert");
					resolve(convertProcess(options, baseBitrate, newCount));
				} else {
					resolve(options.output);
				}
			} else {
				reject(new Error(`ffmpeg exited with code ${code}`));
			}
		});
		ffmpeg.on("error", (error) => reject(error));
	});
}

async function calculateBitrate(video) {
	const duration = await getDurationVideo(video);
	const maxSize = 45;

	const bitrate = (maxSize * 1024 * 1024 * 8) / duration;
	return bitrate;
}

async function getDurationVideo(video) {
	return new Promise((resolve, reject) => {
		const probe = spawn("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", video]);

		let output = "";

		probe.stdout.on("data", (data) => {
			output += data;
		});
		probe.stderr.on("data", (data) => console.error("ffprobe error:", data.toString()));
		probe.on("close", (code) => {
			if (code === 0) {
				resolve(output);
			} else {
				reject(new Error(`ffprobe exited with code ${code}`));
			}
		});
		probe.on("error", (error) => reject(error));
	});
}
