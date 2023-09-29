
import * as vscode from "vscode";
import * as fs from "fs";
import { isSnippet, extractFirstLine } from "./snippet";
import { config, snippets } from "./config";

let lineChangeFlag = false;
const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);

export function showComments() {
    statusBarItem.color = "green";
    statusBarItem.text = "$(extensions-info-message) comments";
    statusBarItem.hide();
		const jsonData = fs.existsSync(config.commentJSONPath) ? JSON.parse(fs.readFileSync(config.commentJSONPath, "utf-8")) : {};

    return vscode.languages.registerCodeLensProvider(
      { scheme: "file" },
      {
        provideCodeLenses(
          document: vscode.TextDocument,
          token: vscode.CancellationToken
        ): vscode.ProviderResult<vscode.CodeLens[]> {
          const codeLenses: vscode.CodeLens[] = [];
          const existingCodeLensRanges: vscode.Range[] = [];

          // Iterate over existing CodeLenses and store their ranges
          for (const codeLens of codeLenses) {
            existingCodeLensRanges.push(codeLens.range);
          }
          config.changedComments = [];
          for (const key in jsonData) {
            const value = jsonData[key];
            
            //parsing the key to get line number
            let lineNumber = +key.split('-')[0];
            const lineText = atob(key.split('-')[1]);

            if(document.lineAt(lineNumber-1).text !== lineText) {
              for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
                const line = document.lineAt(lineIndex);
                if (line.text === (lineText)) {
                    lineChangeFlag = true;
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
                  lineChangeFlag = false;
                }
              }
            // line maybe edited or deleted
              if(!lineChangeFlag) {
                const changedCommentObject = {
                  lineNumber : lineNumber,
                  text: value
                };
                config.changedComments.push(changedCommentObject);
              }
            
            }
            if(!lineChangeFlag  && config.changedComments.length !== 0) {
              statusBarItem.color = "red";
              statusBarItem.text = "$(extensions-info-message) comments";
              statusBarItem.command = "mywiki.showCommentNotifications";
              statusBarItem.show();
            } 
            const commentText = value;
            const range = new vscode.Range(lineNumber - 1, 0, lineNumber - 1, 0);
            if (!existingCodeLensRanges.some((existingRange) => existingRange.contains(range))) {
              const command: vscode.Command = {
                title: isSnippet(commentText)? extractFirstLine(commentText): commentText,
                command: "mywiki.clickComment",
                tooltip: commentText.replace(/(?:\r\n|\r|\n)/g, "\n"),
                arguments: [commentText, lineNumber],
              };
              const codeLens = new vscode.CodeLens(range, command);
              codeLenses.push(codeLens);
            }
          }
          
		const jsonContent = JSON.stringify(jsonData, null, 2);
		fs.writeFileSync(config.commentJSONPath, jsonContent, "utf-8");
          return codeLenses;
        },
      }
    );
  }

export {lineChangeFlag};
  