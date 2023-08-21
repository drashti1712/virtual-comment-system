import * as vscode from "vscode";

const activeEditor = vscode.window.activeTextEditor;
const folderName = vscode.workspace.workspaceFolders !== undefined? vscode.workspace.workspaceFolders[0].name : "";
const newVar = activeEditor ? activeEditor.document.fileName : "";
const newStr = newVar.split(folderName).join(folderName + "\\.docs");
export const config = {
	folderName: folderName,
	document: activeEditor?.document,
    commentJSONPath: newStr + ".json",
    currentFilePath: activeEditor ? activeEditor.document.fileName : ""
};
export const lineConfig = {
	originalLC: activeEditor ? activeEditor.document.lineCount: 0, //original line count when tab switched
	buffer: 0, //buffer 0 means not edited
	editedLine: -1, //initial value is -1, which means not edited 
};
