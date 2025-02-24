const token = process.env.YA_TOKEN;
// const folderPath = "Batumi";
const folderPath = "test"; //имя папки для фильтра результатов запроса
const image_size_limit = 5192448; //Лимит размера файла изображения на отправку в sendMediaGroup (для URL 5мб, для файла - 10мб)
const video_size_limit = 20452352; //Лимит размера файла видео на отправку в sendMediaGroup (для URL 20мб, для файла - 50мб)

// Запрос на последние добавленные файлы
export function lastYaFilesAdded(limit) {
  const url = "https://cloud-api.yandex.net/v1/disk/resources/last-uploaded?limit=";
  const type = "&media_type=image,video";
  const fields = "&fields=items.name,items.path,items.media_type,items.created, items.size";
  let responseObject = fetch(url + limit + type + fields, {
    method: "get",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
  }).then((response) => {
    return response.json();
  });
  return responseObject;
}

//Фильтр данных запроса по названию папки и дате создания, распределение на группы
export function filterRequest(obj, timeStamp) {
  let groupElements = { image: [], video: [], invalid: [] };
  const filteredArr = obj.items.filter((item) => {
    return item.path.split(":")[1].split("/")[1] == folderPath && Date.parse(item.created) > timeStamp;
  });

  // распределение на группы
  //Фильруем по типу файла, размеру и расширению
  filteredArr.forEach((elem) => {
    if (elem.media_type == "image" && /\S+\.jpeg|jpg$/.test(elem.name)) {
      if (elem.size < image_size_limit) {
        groupElements.image.push(elem);
      } else {
        groupElements.invalid.push(elem);
      }
    } else if (elem.media_type == "video" && /\S+\.mp4$/.test(elem.name)) {
      if (elem.size < video_size_limit) {
        groupElements.video.push(elem);
      } else {
        groupElements.invalid.push(elem);
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
      return response.json();
    })
    .then((data) => {
      return data.href;
    });
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
      return response.json();
    })
    .then((data) => {
      const folderObj = data.items.find((elem) => {
        return elem.name == folderPath;
      });
      return folderObj.public_url;
    });
}
