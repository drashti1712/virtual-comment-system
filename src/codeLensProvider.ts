import * as vscode from 'vscode';
import * as fs from 'fs';
import { config, snippets } from "./config";
import { isSnippet, extractFirstLine } from "./snippet";

/**
 * CodelensProvider
 */


export class CodelensProvider implements vscode.CodeLensProvider {

	private codeLenses: vscode.CodeLens[] = [];
	// private regex: RegExp;
	private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
	public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;
	public lineChangeFlag = false;
	private statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	constructor() {
		// this.regex = /(.+)/g;
		this.statusBarItem.color = "green";
		this.statusBarItem.text = "$(extensions-info-message) comments";
		this.statusBarItem.hide();
		vscode.workspace.onDidChangeConfiguration((_) => {
			this._onDidChangeCodeLenses.fire();
		});

	}
	public docChanged() {
		this._onDidChangeCodeLenses.fire();
	}
	public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
		this.codeLenses = [];
		this.statusBarItem.hide();
		const jsonData = fs.existsSync(config.commentJSONPath) ? JSON.parse(fs.readFileSync(config.commentJSONPath, "utf-8")) : {};
		// const codeLenses: vscode.CodeLens[] = [];
		const existingCodeLensRanges: vscode.Range[] = [];
		console.log("executed this line of code");
		// Iterate over existing CodeLenses and store their ranges
		for (const codeLens of this.codeLenses) {
			existingCodeLensRanges.push(codeLens.range);
		}
		config.changedComments = [];
		for (const key in jsonData) {
			const value = jsonData[key];

			//parsing the key to get line number
			let lineNumber = +key.split('-')[0];
			const lineText = atob(key.split('-')[1]);

			if (document.lineAt(lineNumber - 1).text !== lineText) {
				for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
					const line = document.lineAt(lineIndex);
					if (line.text === (lineText)) {
						this.lineChangeFlag = true;
						lineNumber = line.lineNumber + 1; // Line numbers are 0-based
						//changing the line number in json file as well
						const newKey = lineNumber + "-" + btoa(lineText);
						const value = jsonData[key];
						delete jsonData[key];
						jsonData[newKey] = value;
						fs.writeFileSync(
							config.commentJSONPath,
							JSON.stringify(jsonData, null, 2)
						);
						break;
					} else {
						this.lineChangeFlag = false;
					}
				}
				// line maybe edited or deleted
				if (!this.lineChangeFlag) {
					const changedCommentObject = {
						lineNumber: lineNumber,
						text: value
					};
					config.changedComments.push(changedCommentObject);
				}

			}
			if (!this.lineChangeFlag && config.changedComments.length !== 0) {
				this.statusBarItem.color = "red";
				this.statusBarItem.text = "$(extensions-info-message) comments";
				this.statusBarItem.command = "mywiki.showCommentNotifications";
				this.statusBarItem.show();
			}
			const commentText = value;
			const range = new vscode.Range(lineNumber - 1, 0, lineNumber - 1, 0);
			if (!existingCodeLensRanges.some((existingRange) => existingRange.contains(range))) {
				const command: vscode.Command = {
					title: isSnippet(commentText) ? extractFirstLine(commentText) : commentText,
					command: "mywiki.clickComment",
					tooltip: commentText.replace(/(?:\r\n|\r|\n)/g, "\n"),
					arguments: [commentText, lineNumber],
				};
				const codeLens = new vscode.CodeLens(range, command);
				this.codeLenses.push(codeLens);
			}
		}

		const jsonContent = JSON.stringify(jsonData, null, 2);
		fs.writeFileSync(config.commentJSONPath, jsonContent, "utf-8");
		return this.codeLenses;
	}

	public resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken) {
		return null;
	}
}
