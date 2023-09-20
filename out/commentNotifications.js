"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.showCommentNotifications = void 0;
const vscode = require("vscode");
exports.showCommentNotifications = vscode.commands.registerCommand('mywiki.showCommentNotifications', () => {
    console.log("Code to actually show the notifications when the status bar icon is clicked");
});
//# sourceMappingURL=commentNotifications.js.map