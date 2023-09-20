
import * as vscode from "vscode";
import * as fs from "fs";
import { isSnippet, extractFirstLine } from "./snippet";
import { config } from "./config";

let lineChangeFlag = false;
const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);

export function showComments() {
    statusBarItem.color = "green";
    statusBarItem.text = "$(extensions-info-message) comments";
    statusBarItem.command = "mywiki.showNoChangesCommentsMessage";
    statusBarItem.hide();
		const jsonData = fs.existsSync(config.commentJSONPath) ? JSON.parse(fs.readFileSync(config.commentJSONPath, "utf-8")) : {};
		for (const key in jsonData) {
				const value = jsonData[key];
				console.log(`Key: ${key}, Value: ${value}`);
		}

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
          let i=1;
          config.changedComments = [];
          for (const key in jsonData) {
            console.log("i ", i++);
            const value = jsonData[key];
            
            //parsing the key to get line number
            let lineNumber = +key.split('-')[0];
            const lineText = atob(key.split('-')[1]);
            
            //case 1: file is not edited

            //case 2 : file is edited
            console.log("stored data check", lineText);
            console.log("document check", document.lineAt(lineNumber-1).text);
            if(document.lineAt(lineNumber-1).text !== lineText) {
            // line may have shifted -- find new line number
              console.log("here");
              for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
                const line = document.lineAt(lineIndex);
                if (line.text === (lineText)) {
                    console.log("CASE LINE NUMBER CHANGE -- found it at", line.lineNumber);
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
                }
              }
            // line maybe edited or deleted -- delete comment?
              if(!lineChangeFlag) {
                // delete functinality
                console.log("CASE SHOW MESSAGE");
                const changedCommentObject = {
                  lineNumber : lineNumber,
                  text: value
                };
                config.changedComments.push(changedCommentObject);
                // config.changedComments.push("Line "+ lineNumber + " : " + value + "\n");
              }
            
            } else {
              console.log("CASE NO Change");
            }
            console.log("changed comments: 🔹🔹🔹🔹🔹", config.changedComments);
            if(!lineChangeFlag  && config.changedComments.length !== 0) {
              statusBarItem.color = "red";
              statusBarItem.text = "$(extensions-info-message) comments";
              statusBarItem.command = "mywiki.showCommentNotifications";
              statusBarItem.show();
            } else {
              statusBarItem.color = "green";
              statusBarItem.text = "$(extensions-info-message) comments";
            }
			//original code
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
          
		//writing modified data back
		const jsonContent = JSON.stringify(jsonData, null, 2);
		fs.writeFileSync(config.commentJSONPath, jsonContent, "utf-8");
          return codeLenses;
        },
      }
    );
  }

export {lineChangeFlag};
  