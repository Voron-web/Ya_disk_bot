import logger from "../index.js";
const token = process.env.YA_TOKEN;
const folderPath = String(process.env.FOLDER); //имя папки для фильтра результатов запроса

const image_size_limit = 5192448; //Лимит размера файла изображения на отправку в sendMediaGroup (для URL 5мб, для файла - 10мб)
const video_size_limit = 20452352; //Лимит размера файла видео на отправку в sendMediaGroup (для URL 20мб, для файла - 50мб)

/**
 * Get last loading files from yaDiskAPI
 *
 * @param {Number} limit - Limit files in request
 * @returns {Object} Request from YaDisk API
 * @example
 *
 * {  "items": [
 *     {
 *       "name": "photo2.png",
 *       "preview": "https://downloader.disk.yandex.ru/preview/...",
 *       "created": "2014-04-22T14:57:13+04:00",
 *       "modified": "2014-04-22T14:57:14+04:00",
 *       "path": "disk:/foo/photo2.png",
 *       "md5": "53f4dc6379c8f95ddf11b9508cfea271",
 *       "type": "file",
 *       "mime_type": "image/png",
 *       "size": 54321
 *     },
 *     {
 *       "name": "photo1.png",
 *       "preview": "https://downloader.disk.yandex.ru/preview/...",
 *       "created": "2014-04-21T14:57:13+04:00",
 *       "modified": "2014-04-21T14:57:14+04:00",
 *       "path": "disk:/foo/photo1.png",
 *       "md5": "4334dc6379c8f95ddf11b9508cfea271",
 *       "type": "file",
 *       "mime_type": "image/png",
 *       "size": 34567
 *     }
 *   ],
 *   "limit": 20,
 * }
 *
 */
export async function lastYaFilesAdded(limit) {
	console.log("lastYaFilesAdded");

	const url = "https://cloud-api.yandex.net/v1/disk/resources/last-uploaded?limit=";
	const type = "&media_type=image,video";
	const fields = "&fields=items.name,items.path,items.media_type,items.created, items.size";
	let responseObject = await fetch(url + limit + type + fields, {
		method: "get",
		headers: {
			"Content-Type": "application/json",
			Authorization: token,
		},
	})
		.then((response) => {
			if (!response.ok) {
				throw new Error(`Error HTTP request: ${response.status}`);
			} else {
				return response.json();
			}
		})
		.catch((error) => logger.error({ message: error.message, stack: error.stack }));

	return responseObject;
}

/**
 * Filter response object by create time and path (target folder), divide items by type
 *
 * @param {Object} obj - response object from yaDisk API
 * @param {Date} timeStamp - last sended file time create
 * @returns {Object} filtered and separated object
 * @example
 * {
 * image: [
 *  {
 *       "name": "photo2.png",
 *       "preview": "https://downloader.disk.yandex.ru/preview/...",
 *       ...
 *     },
 * ],
 * video: [
 *  {
 *       "name": "Video2.mp4",
 *       "preview": "https://downloader.disk.yandex.ru/preview/...",
 *       "created": "2014-04-22T14:57:13+04:00",
 *       "modified": "2014-04-22T14:57:14+04:00",
 *       "type": "file",
 *       "mime_type": "video/mp4",
 *       "size": 54321
 * 		 ...
 *     },
 * ],
 * invalidImages: [],
 * invalidVideos: []
 * }
 *
 */
export function filterRequest(obj, timeStamp) {
	console.log(folderPath);

	// get new files list
	let groupElements = { image: [], video: [], invalidImages: [], invalidVideos: [] };
	const filteredArr = obj.items.filter((item) => {
		return item.path.split(":")[1].split("/")[1] == folderPath && Date.parse(item.created) > timeStamp;
	});

	// divide by groups
	//Фильруем по типу файла, размеру и расширению
	filteredArr.forEach((elem) => {
		if (elem.media_type == "image" && /\S+\.(jpeg|jpg)$/gi.test(elem.name)) {
			if (elem.size < image_size_limit) {
				groupElements.image.push(elem);
			} else {
				groupElements.invalidImages.push(elem);
			}
		} else if (elem.media_type == "video" /*&& /\S+\.mp4$/gi.test(elem.name)*/) {
			if (elem.size < video_size_limit) {
				groupElements.video.push(elem);
			} else {
				groupElements.invalidVideos.push(elem);
			}
		}
	});

	return groupElements;
}

// Получение прямой ссылки на файл
export function getFile(path) {
	const getLinkUrl = "https://cloud-api.yandex.net/v1/disk/resources/download?path=" + path;

	return fetch(getLinkUrl, {
		method: "get",
		headers: {
			"Content-Type": "application/json",
			Authorization: token,
		},
	})
		.then((response) => {
			if (!response.ok) {
				throw new Error(`Error HTTP request: ${response.status}`);
			} else {
				return response.json();
			}
		})
		.then((data) => {
			return data.href;
		})
		.catch((error) => logger.error({ message: error.message, stack: error.stack }));
}

// Получение публичной ссылки на папку
export function getFolderLink() {
	return fetch("https://cloud-api.yandex.net/v1/disk/resources/public?limit=10&type=dir&fields=items.name,items.public_url", {
		method: "get",
		headers: {
			"Content-Type": "application/json",
			Authorization: token,
		},
	})
		.then((response) => {
			if (!response.ok) {
				throw new Error(`Error HTTP request: ${response.status}`);
			} else {
				return response.json();
			}
		})
		.then((data) => {
			const folderObj = data.items.find((elem) => {
				return elem.name == folderPath;
			});
			return folderObj.public_url;
		})
		.catch((error) => logger.error({ message: error.message, stack: error.stack }));
}
