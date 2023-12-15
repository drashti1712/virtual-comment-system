import * as fs from "fs";
import { config } from "./config";
import { NewComment } from './extension';

export default function editComment(newComment: NewComment) {
  let existingData: any;
    //case: file already exists
    if (fs.existsSync(config.commentJSONPath)) {
      const fileContent = fs.readFileSync(config.commentJSONPath, "utf8");
      existingData = JSON.parse(fileContent);
    }

    for (const key in existingData) {
      const lineNumber = +key.split('-')[0];
      if (lineNumber == newComment.line) {
        existingData[key] = newComment.body.toString();
        fs.writeFileSync(
          config.commentJSONPath,
          JSON.stringify(existingData, null, 2)
        );
        break;
      }			
    }
}