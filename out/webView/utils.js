"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.editComment = exports.deleteComment = exports.keepComment = void 0;
const vscode = require("vscode");
const fs = require("fs");
const config_1 = require("../config");
const extension_1 = require("../extension");
function keepComment(commentText) {
    // from comment text find line number
    const content = fs.existsSync(config_1.config.commentJSONPath)
        ? JSON.parse(fs.readFileSync(config_1.config.commentJSONPath, "utf-8"))
        : {};
    for (const key in content) {
        if (content[key] === commentText) {
            const lineNumber = +key.split('-')[0];
            const codeLine = config_1.config.document?.lineAt(lineNumber - 1).text || "";
            const newKey = lineNumber + "-" + btoa(codeLine);
            const value = content[key];
            delete content[key];
            content[newKey] = value;
            fs.writeFileSync(config_1.config.commentJSONPath, JSON.stringify(content, null, 2));
            break;
        }
    }
}
exports.keepComment = keepComment;
function deleteComment(commentText) {
    const content = fs.existsSync(config_1.config.commentJSONPath)
        ? JSON.parse(fs.readFileSync(config_1.config.commentJSONPath, "utf-8"))
        : {};
    for (const key in content) {
        if (content[key] === commentText) {
            delete content[key];
            fs.writeFileSync(config_1.config.commentJSONPath, JSON.stringify(content, null, 2));
            break;
        }
    }
}
exports.deleteComment = deleteComment;
function editComment(message, commentController) {
    const newComment = new extension_1.NewComment(message.text, message.lineNumber, vscode.CommentMode.Editing, { name: " " });
    const thread = commentController.createCommentThread(vscode.Uri.file(config_1.config.currentFilePath), new vscode.Range(message.lineNumber - 1, 0, message.lineNumber - 1, 0), [newComment]);
    thread.canReply = false;
    thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
    thread.label = " ";
    newComment.parent = thread;
}
exports.editComment = editComment;
//# sourceMappingURL=utils.js.map