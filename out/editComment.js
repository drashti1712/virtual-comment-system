"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const config_1 = require("./config");
function editComment(newComment) {
    let existingData;
    //case: file already exists
    if (fs.existsSync(config_1.config.commentJSONPath)) {
        const fileContent = fs.readFileSync(config_1.config.commentJSONPath, "utf8");
        existingData = JSON.parse(fileContent);
    }
    for (const key in existingData) {
        const lineNumber = +key.split('-')[0];
        if (lineNumber == newComment.line) {
            existingData[key] = newComment.body.toString();
            fs.writeFileSync(config_1.config.commentJSONPath, JSON.stringify(existingData, null, 2));
            break;
        }
    }
}
exports.default = editComment;
//# sourceMappingURL=editComment.js.map