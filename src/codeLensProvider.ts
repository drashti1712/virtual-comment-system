import * as vscode from 'vscode';
import * as fs from 'fs';
import { config, snippets } from "./config";
import { isSnippet, extractFirstLine } from "./snippet";

/**
 * CodelensProvider
 */


export class CodelensProvider implements vscode.CodeLensProvider {

	private codeLenses: vscode.CodeLens[] = [];
	private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
	public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;
	public lineChangeFlag = false;
	private statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	constructor() {
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
	public async provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.CodeLens[]> {
		if (document.uri.path.includes('/.docs/')) {
			return this.codeLenses;
		}
		this.codeLenses = [];
		this.statusBarItem.hide();
		const jsonData = JSON.parse((await fs.promises.readFile(config.commentJSONPath)).toString()) || {};
		const existingCodeLensRanges: vscode.Range[] = [];
		console.log("executed this line of code");
		for (const codeLens of this.codeLenses) {
			existingCodeLensRanges.push(codeLens.range);
		}
		config.changedComments = [];
		for (const key in jsonData) {
			const value = jsonData[key];
			let lineNumber = +key.split('-')[0];
			const lineText = atob(key.split('-')[1]);

			if (document.lineAt(lineNumber - 1).text !== lineText) {
				if (lineText === '') {
					//remove comment ||  hide them
					continue;
				}
				for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
					const line = document.lineAt(lineIndex);
					if (line.text === (lineText) && lineText !== '') {
						this.lineChangeFlag = true;
						lineNumber = line.lineNumber + 1;
						const newKey = lineNumber + "-" + btoa(lineText);
						const value = jsonData[key];
						delete jsonData[key];
						jsonData[newKey] = value;
						fs.promises.writeFile(
							config.commentJSONPath,
							JSON.stringify(jsonData, null, 2)
						);
						break;
					} else {
						this.lineChangeFlag = false;
					}
				}
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
		fs.promises.writeFile(config.commentJSONPath, jsonContent + "\n", "utf-8");
		return this.codeLenses;
	}

	public resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken) {
		return null;
	}
}
