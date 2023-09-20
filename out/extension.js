"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = exports.NewComment = void 0;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const snippet_1 = require("./snippet");
const config_1 = require("./config");
const showComments_1 = require("./showComments");
const webViewPanel_1 = require("./webView/webViewPanel");
const editComment_1 = require("./editComment");
let commentId = 1;
class NewComment {
    constructor(body, line, mode, author, parent, contextValue) {
        this.body = body;
        this.line = line;
        this.mode = mode;
        this.author = author;
        this.parent = parent;
        this.contextValue = contextValue;
        this.id = ++commentId;
        this.savedBody = this.body;
        this.label = " ";
    }
}
exports.NewComment = NewComment;
function activate(context) {
    const commentController = vscode.comments.createCommentController("virtual-comment-system", "Virtual Comment System");
    context.subscriptions.push(commentController);
    commentController.commentingRangeProvider = { provideCommentingRanges: (document) => {
            return [new vscode.Range(0, 0, document.lineCount - 1, 0)];
        },
    };
    commentController.options = {
        placeHolder: "Type a new comment or add a snippet",
        prompt: " ",
    };
    let commentProvider = (0, showComments_1.showComments)();
    vscode.workspace.onDidSaveTextDocument((document) => {
        commentProvider = (0, showComments_1.showComments)();
    });
    vscode.workspace.onDidChangeTextDocument((event) => {
        //disable codelens - 2
        commentProvider.dispose();
        // const editedDocument = event.document;
        // const editedLine = editedDocument.lineAt(event.contentChanges[0].range.start);
        // const editedLineNumber = editedLine.lineNumber;
        // // lineConfig.e/ditedLine = editedLineNumber+1;
        // const str = editedDocument.lineAt(editedLineNumber).text;
        // if (str !== "") {
        //   // edit the str hash to btoa(str)
        //   editLineText(editedLineNumber+1, str);
        // }
    });
    vscode.window.onDidChangeTextEditorViewColumn((event) => {
        console.log("viewColumn change");
    });
    vscode.window.onDidChangeActiveTextEditor((event) => {
        if (!event)
            return;
        //changing filePath on tab change
        const newStr = event.document.uri.path.split(config_1.config.folderName);
        const newStr2 = path.join(newStr[0], config_1.config.folderName, ".docs", newStr[1]);
        config_1.config.currentFilePath = event.document.uri.path;
        config_1.config.commentJSONPath = (newStr2 + ".json");
        config_1.config.document = vscode.window.activeTextEditor?.document;
        config_1.config.folderName = vscode.workspace.workspaceFolders !== undefined ? vscode.workspace.workspaceFolders[0].name : "";
        config_1.config.fileName = newStr2.slice(newStr2.lastIndexOf('/') + 1, newStr2.length);
        commentProvider.dispose();
        commentProvider = (0, showComments_1.showComments)();
    });
    context.subscriptions.push(vscode.commands.registerCommand('mywiki.showCommentNotifications', () => {
        if (!showComments_1.lineChangeFlag && config_1.config.changedComments.length !== 0) {
            (0, webViewPanel_1.default)(config_1.config.changedComments, context, commentController);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('mywiki.showNoChangesCommentsMessage', () => {
        vscode.window.showInformationMessage("All good! No modified code associated with the comments.");
    }));
    // const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    // statusBarItem.color = "lightblue";
    // statusBarItem.text = "$(extensions-info-message) comments";
    // statusBarItem.command = "mywiki.showCommentNotifications";
    // statusBarItem.show();
    context.subscriptions.push(vscode.commands.registerCommand("mywiki.addComment", (reply) => {
        const thread = reply.thread;
        thread.canReply = false;
        thread.label = " ";
        const newComment = new NewComment(reply.text, thread.range.start.line + 1, vscode.CommentMode.Preview, { name: "" }, thread, undefined);
        newComment.label = " ";
        writeToFile(newComment);
        thread.comments = [...thread.comments, newComment];
        commentProvider.dispose();
        commentProvider = (0, showComments_1.showComments)();
        thread.dispose();
    }));
    context.subscriptions.push(vscode.commands.registerCommand("mywiki.addSnippet", (reply) => {
        const lineNo = reply.thread.range.start.line;
        const lineText = config_1.config.document?.lineAt(lineNo).text;
        const snippet = (0, snippet_1.getSnippet)(lineText);
        reply.thread.canReply = false;
        reply.thread.label = " ";
        const newComment = new NewComment(snippet, lineNo + 1, vscode.CommentMode.Editing, { name: " " });
        reply.thread.comments = [...reply.thread.comments, newComment];
        newComment.parent = reply.thread;
        newComment.contextValue = "snippet";
        newComment.label = " ";
    }));
    context.subscriptions.push(vscode.commands.registerCommand("mywiki.deleteComment", (thread) => {
        const content = fs.existsSync(config_1.config.commentJSONPath)
            ? JSON.parse(fs.readFileSync(config_1.config.commentJSONPath, "utf-8"))
            : {};
        for (const key in content) {
            if (content[key] === thread.comments[0].body) {
                delete content[key];
                fs.writeFileSync(config_1.config.commentJSONPath, JSON.stringify(content, null, 2));
                break;
            }
        }
        thread.dispose();
        commentProvider.dispose();
        commentProvider = (0, showComments_1.showComments)();
    }));
    context.subscriptions.push(vscode.commands.registerCommand("mywiki.cancelsaveComment", (comment) => {
        console.log("🍏🍏🍏🍏🍏🍏🍏🍏🍏🍏🍏🍏🍏🍏🍏🍏🍏🍏🍏🍏🍏🍏 CANCEL CLICKED");
        if (!comment.parent) {
            return;
        }
        comment.parent.comments = comment.parent.comments.map((cmt) => {
            if (cmt.id === comment.id) {
                cmt.body = cmt.savedBody;
                cmt.mode = vscode.CommentMode.Preview;
            }
            return cmt;
        });
        comment.parent.dispose();
    }));
    context.subscriptions.push(vscode.commands.registerCommand("mywiki.saveComment", (comment) => {
        comment.mode = vscode.CommentMode.Preview;
        if (comment.contextValue === "snippet") {
            writeToFile(comment);
        }
        else {
            (0, editComment_1.default)(comment);
        }
        commentProvider.dispose();
        commentProvider = (0, showComments_1.showComments)();
        comment.parent?.dispose();
    }));
    context.subscriptions.push(vscode.commands.registerCommand("mywiki.clickComment", (text, lineNumber) => {
        commentProvider.dispose();
        commentProvider = (0, showComments_1.showComments)();
        const newComment = new NewComment(text, lineNumber, vscode.CommentMode.Editing, { name: " " });
        const thread = commentController.createCommentThread(vscode.Uri.file(config_1.config.currentFilePath), new vscode.Range(lineNumber - 1, 0, lineNumber - 1, 0), [newComment]);
        thread.canReply = false;
        thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
        thread.label = " ";
        newComment.parent = thread;
    }));
    function createCommentObject(key, value) {
        const obj = {};
        obj[key] = value;
        return obj;
    }
    function writeToFile(newComment) {
        const lineNo = newComment.parent
            ? newComment.parent.range.start.line + 1
            : newComment.line;
        const lineText = config_1.config.document?.lineAt(lineNo - 1).text || '';
        const commentObj = createCommentObject(lineNo + "-" + btoa(lineText), newComment.body.toString());
        // Read the existing data from the file
        let existingData = [];
        const folderPath = config_1.config.commentJSONPath;
        const separatingIndex = folderPath.lastIndexOf("/");
        const p1 = folderPath.slice(0, separatingIndex);
        //case: file already exists
        if (fs.existsSync(folderPath)) {
            const fileContent = fs.readFileSync(folderPath, "utf8");
            existingData = JSON.parse(fileContent);
        }
        const updatedData = { ...existingData, ...commentObj };
        const jsonContent = JSON.stringify(updatedData, null, 2);
        try {
            fs.mkdirSync(p1, { recursive: true });
        }
        catch (e) {
            console.log(e);
        }
        fs.writeFileSync(folderPath, jsonContent, "utf8");
    }
}
exports.activate = activate;
//# sourceMappingURL=extension.js.map