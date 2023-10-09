"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const config_1 = require("../config");
const htmlContent_1 = require("./htmlContent");
const utils_1 = require("./utils");
let commentListPanel;
function showCommentListPanel(comments, context, commentController) {
    if (commentListPanel) {
        commentListPanel.reveal();
    }
    else {
        commentListPanel = vscode.window.createWebviewPanel('commentList', config_1.config.fileName, vscode.ViewColumn.Two, {
            enableScripts: true,
        });
        commentListPanel.webview.html = (0, htmlContent_1.getWebViewContent)(comments);
        commentListPanel.onDidDispose(() => {
            commentListPanel = undefined;
        });
        vscode.window.onDidChangeActiveTextEditor((e) => {
            if (!commentListPanel?.active) {
                commentListPanel?.dispose();
            }
        });
        commentListPanel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'delete': {
                    (0, utils_1.deleteComment)(message.text);
                    vscode.window.showInformationMessage("Comment deleted!");
                    updateChangedComments(message);
                    return;
                }
                case 'keep': {
                    (0, utils_1.keepComment)(message.text);
                    vscode.window.showInformationMessage("Saved changes!");
                    updateChangedComments(message);
                    return;
                }
                case 'edit': {
                    (0, utils_1.editComment)(message, commentController);
                    (0, utils_1.keepComment)(message.text);
                    updateChangedComments(message);
                    return;
                }
            }
        }, undefined, context.subscriptions);
    }
}
exports.default = showCommentListPanel;
function updateChangedComments(message) {
    const updatedComments = [];
    config_1.config.changedComments.forEach(comment => {
        if (comment.lineNumber != message.lineNumber) {
            updatedComments.push(comment);
        }
    });
    config_1.config.changedComments = updatedComments;
    if (updatedComments.length === 0) {
        commentListPanel?.dispose();
    }
    if (commentListPanel)
        commentListPanel.webview.html = (0, htmlContent_1.getWebViewContent)(updatedComments);
}
//# sourceMappingURL=webViewPanel.js.map