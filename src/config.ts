import * as vscode from "vscode";

const activeEditor = vscode.window.activeTextEditor;
const folderName = vscode.workspace.workspaceFolders !== undefined? vscode.workspace.workspaceFolders[0].name : "";
const newVar = activeEditor ? activeEditor.document.fileName : "";
const newStr = newVar.split(folderName).join(folderName + "/.docs");

export const config = {
	folderName: folderName,
	document: activeEditor?.document,
    commentJSONPath: newStr + ".json",
    currentFilePath: activeEditor ? activeEditor.document.fileName : "",
	changedComments: [{ lineNumber: 0, text: 'random text'}],
	fileName: "comments",
	isSnippet: false
};

export const snippets = {
	function:
	"/**\n* This is a function.\n*\n* @param {string} n - A string param\n* @param {string} [o] - A optional string param\n* @param {string} [d=DefaultValue] - A optional string param\n* @return {string} A good string\n*\n* @example\n*\n*     foo('hello')\n*/",
	class: "/**\n* Represents a class.\n* @constructor\n* @param {type} x - Parameter x.\n* @param {type} y - Parameter y.\n*/",
	variable: "/**\n* Variable Name\n* @type {variable-type}\n*/",
	default: "/**\n* Default comment\n*/"
};