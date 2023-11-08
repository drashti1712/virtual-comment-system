import * as fs from "fs";
import { config } from "./config";
import { NewComment } from './extension';

export default async function editComment(newComment: NewComment) {
  //case: file already exists
  const existingData = JSON.parse((await fs.promises.readFile(config.commentJSONPath)).toString()) || {};
  for (const key in existingData) {
    const lineNumber = +key.split('-')[0];
    if (lineNumber == newComment.line) {
      existingData[key] = newComment.body.toString();
      fs.promises.writeFile(config.commentJSONPath,
        JSON.stringify(existingData, null, 2));
      break;
    }
  }
}