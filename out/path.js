"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lineConfig = exports.config = void 0;
const vscode = require("vscode");
const activeEditor = vscode.window.activeTextEditor;
const folderName = vscode.workspace.workspaceFolders !== undefined ? vscode.workspace.workspaceFolders[0].name : "";
const newVar = activeEditor ? activeEditor.document.fileName : "";
const newStr = newVar.split(folderName).join(folderName + "\\.docs");
exports.config = {
    folderName: folderName,
    document: activeEditor?.document,
    commentJSONPath: newStr + ".json",
    currentFilePath: activeEditor ? activeEditor.document.fileName : ""
};
exports.lineConfig = {
    originalLC: activeEditor ? activeEditor.document.lineCount : 0,
    buffer: 0,
    editedLine: -1, //initial value is -1, which means not edited 
};
//# sourceMappingURL=path.js.map