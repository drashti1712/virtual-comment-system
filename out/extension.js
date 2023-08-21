"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const snippet_1 = require("./snippet");
const path_1 = require("./path");
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
function activate(context) {
    const commentController = vscode.comments.createCommentController("virtual-comment-system", "Virtual Comment System");
    context.subscriptions.push(commentController);
    commentController.commentingRangeProvider = {
        provideCommentingRanges: (document) => {
            return [new vscode.Range(0, 0, document.lineCount - 1, 0)];
        },
    };
    commentController.options = {
        placeHolder: "Type a new comment or add a snippet",
        prompt: " ",
    };
    let commentProvider = showComments();
    vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
        // when you change text editor range
    });
    vscode.workspace.onDidSaveTextDocument((document) => {
        //modify lines and show codelens - 1
        console.log("saved!!", document.lineCount);
        const newLC = document.lineCount;
        if (path_1.lineConfig.originalLC === newLC) {
            console.log("No changes!!");
        }
        else {
            path_1.lineConfig.buffer = path_1.lineConfig.originalLC - newLC;
            path_1.lineConfig.originalLC = newLC;
        }
        commentProvider = showComments();
    });
    vscode.workspace.onDidChangeTextDocument((event) => {
        //disable codelens - 2
        commentProvider.dispose();
        const editedDocument = event.document;
        const editedLine = editedDocument.lineAt(event.contentChanges[0].range.start);
        const editedLineNumber = editedLine.lineNumber;
        path_1.lineConfig.editedLine = editedLineNumber + 1;
        console.log(`Edited line number: ${editedLineNumber + 1}`);
    });
    vscode.window.onDidChangeActiveTextEditor((event) => {
        if (!event)
            return;
        //changing filePath on tab change
        const newStr = event.document.uri.path.split(path_1.config.folderName);
        const newStr2 = path.join(newStr[0], path_1.config.folderName, ".docs", newStr[1]);
        path_1.config.currentFilePath = event.document.uri.path;
        path_1.config.commentJSONPath = (newStr2 + ".json")
            .replace(/\\/g, "\\\\")
            .slice(2);
        //changing buffer, editedLineNumber, originalLC
        path_1.lineConfig.originalLC = event.document.lineCount;
        path_1.lineConfig.buffer = 0;
        path_1.lineConfig.editedLine = -1;
        console.log("Text editor changed", path_1.lineConfig.originalLC, path_1.lineConfig.buffer);
        commentProvider.dispose();
        commentProvider = showComments();
    });
    context.subscriptions.push(vscode.commands.registerCommand("mywiki.addComment", (reply) => {
        const thread = reply.thread;
        thread.canReply = false;
        thread.label = " ";
        const newComment = new NewComment(reply.text, thread.range.start.line + 1, vscode.CommentMode.Preview, { name: "" }, thread, undefined);
        newComment.label = " ";
        writeToFile(newComment);
        thread.comments = [...thread.comments, newComment];
        commentProvider.dispose();
        commentProvider = showComments();
        thread.dispose();
    }));
    context.subscriptions.push(vscode.commands.registerCommand("mywiki.addSnippet", (reply) => {
        const lineNo = reply.thread.range.start.line;
        const lineText = path_1.config.document?.lineAt(lineNo).text;
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
        const content = fs.existsSync(path_1.config.commentJSONPath)
            ? JSON.parse(fs.readFileSync(path_1.config.commentJSONPath, "utf-8"))
            : [];
        const index = content.findIndex((obj) => obj.text === thread.comments[0].body);
        if (index !== -1) {
            content.splice(index, 1);
        }
        fs.writeFileSync(path_1.config.commentJSONPath, JSON.stringify(content, null, 2));
        thread.dispose();
        commentProvider.dispose();
        commentProvider = showComments();
    }));
    context.subscriptions.push(vscode.commands.registerCommand("mywiki.cancelsaveComment", (comment) => {
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
            editComment(comment);
        }
        commentProvider.dispose();
        commentProvider = showComments();
        comment.parent?.dispose();
    }));
    context.subscriptions.push(vscode.commands.registerCommand("mywiki.clickComment", (text, lineNumber) => {
        commentProvider.dispose();
        commentProvider = showComments();
        const newComment = new NewComment(text, lineNumber, vscode.CommentMode.Editing, { name: " " });
        const thread = commentController.createCommentThread(vscode.Uri.file(path_1.config.currentFilePath), new vscode.Range(lineNumber - 1, 0, lineNumber - 1, 0), [newComment]);
        thread.canReply = false;
        thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
        thread.label = " ";
        newComment.parent = thread;
    }));
    function showComments() {
        console.log('lineConfig', path_1.lineConfig);
        const content = fs.existsSync(path_1.config.commentJSONPath)
            ? JSON.parse(fs.readFileSync(path_1.config.commentJSONPath, "utf-8"))
            : [];
        console.log(content);
        return vscode.languages.registerCodeLensProvider({ scheme: "file" }, {
            provideCodeLenses(document, token) {
                const codeLenses = [];
                const existingCodeLensRanges = [];
                // Iterate over existing CodeLenses and store their ranges
                for (const codeLens of codeLenses) {
                    existingCodeLensRanges.push(codeLens.range);
                }
                for (const entry of content) {
                    //add logic to set new line number
                    if (path_1.lineConfig.buffer !== 0 && entry.lineNumber > (path_1.lineConfig.editedLine + path_1.lineConfig.buffer)) {
                        entry.lineNumber = entry.lineNumber - path_1.lineConfig.buffer;
                        //modify line Number in json file
                    }
                    //original code
                    const commentText = entry.text;
                    const range = new vscode.Range(entry.lineNumber - 1, 0, entry.lineNumber - 1, 0);
                    if (!existingCodeLensRanges.some((existingRange) => existingRange.contains(range))) {
                        const command = {
                            title: (0, snippet_1.isSnippet)(commentText)
                                ? (0, snippet_1.extractFirstLine)(commentText)
                                : commentText,
                            command: "mywiki.clickComment",
                            tooltip: commentText.replace(/(?:\r\n|\r|\n)/g, "\n"),
                            arguments: [commentText, entry.lineNumber],
                        };
                        const codeLens = new vscode.CodeLens(range, command);
                        codeLenses.push(codeLens);
                    }
                }
                // console.log("Content", content);
                //writing modified data back
                const jsonContent = JSON.stringify(content, null, 2);
                fs.writeFileSync(path_1.config.commentJSONPath, jsonContent, "utf-8");
                return codeLenses;
            },
        });
    }
    function writeToFile(newComment) {
        const lineNo = newComment.parent
            ? newComment.parent.range.start.line + 1
            : newComment.line;
        const commentObj = [
            {
                lineNumber: lineNo,
                text: newComment.body,
            },
        ];
        // Read the existing data from the file
        let existingData = [];
        const folderPath = path_1.config.commentJSONPath;
        const separatingIndex = folderPath.lastIndexOf("\\\\");
        const p1 = folderPath.slice(0, separatingIndex);
        //case: file already exists
        if (fs.existsSync(folderPath)) {
            const fileContent = fs.readFileSync(folderPath, "utf8");
            existingData = JSON.parse(fileContent);
        }
        const updatedData = [...existingData, ...commentObj];
        const jsonContent = JSON.stringify(updatedData, null, 2);
        try {
            fs.mkdirSync(p1, { recursive: true });
        }
        catch (e) {
            console.log(e);
        }
        fs.writeFileSync(folderPath, jsonContent, "utf8");
    }
    function editComment(newComment) {
        let existingData = [];
        //case: file already exists
        if (fs.existsSync(path_1.config.commentJSONPath)) {
            const fileContent = fs.readFileSync(path_1.config.commentJSONPath, "utf8");
            existingData = JSON.parse(fileContent);
        }
        const matchingObject = existingData.find((obj) => obj.lineNumber === newComment.line);
        if (matchingObject) {
            matchingObject.text = newComment.body;
            fs.writeFileSync(path_1.config.commentJSONPath, JSON.stringify(existingData, null, 2));
        }
    }
}
exports.activate = activate;
//# sourceMappingURL=extension.js.map