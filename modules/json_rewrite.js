// import { ifError } from "assert";
// import { error } from "console";
import fs from "fs";

const file = "data.json";

const defSettings = {
  lastUpdate: 0,
  lastFile: "",
};

export function readSettingFile() {
  let resoult;
  try {
    resoult = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    if (error.code == "ENOENT") {
      resoult = defSettings;
      rewriteSettingFile(defSettings);
    } else {
      console.error(error);
    }
  }
  return resoult;
}

export function rewriteSettingFile(data) {
  fs.writeFileSync(file, JSON.stringify(data), (err) => {
    if (err) throw err;
  });
  console.log("Файл", file, "обновлен");
}
