"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const fs = require("fs");
const config_1 = require("../config");
const extension_1 = require("../extension");
const htmlContent_1 = require("./htmlContent");
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
                    deleteComment(message.text);
                    vscode.window.showInformationMessage("Comment deleted!");
                    updateChangedComments(message);
                    return;
                }
                case 'keep': {
                    keepComment(message.text);
                    vscode.window.showInformationMessage("Saved changes!");
                    updateChangedComments(message);
                    return;
                }
                case 'edit': {
                    editComment(message, commentController);
                    keepComment(message.text);
                    updateChangedComments(message);
                    return;
                }
            }
        }, undefined, context.subscriptions);
    }
}
exports.default = showCommentListPanel;
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
function editComment(message, commentController) {
    const newComment = new extension_1.NewComment(message.text, message.lineNumber, vscode.CommentMode.Editing, { name: " " });
    const thread = commentController.createCommentThread(vscode.Uri.file(config_1.config.currentFilePath), new vscode.Range(message.lineNumber - 1, 0, message.lineNumber - 1, 0), [newComment]);
    thread.canReply = false;
    thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
    thread.label = " ";
    newComment.parent = thread;
}
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