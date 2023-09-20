import * as vscode from 'vscode';
import * as fs from "fs";
import { config } from "../config";
import { NewComment } from '../extension';

let commentListPanel: vscode.WebviewPanel | undefined;

export default function showCommentListPanel(comments: { lineNumber: number; text: string; }[], context: vscode.ExtensionContext, commentController: vscode.CommentController) {
    if (commentListPanel) {
        commentListPanel.reveal();
    } else {
        commentListPanel = vscode.window.createWebviewPanel(
            'commentList',
            config.fileName,
            vscode.ViewColumn.Two,
            {
				enableScripts: true,
			}
        );
        commentListPanel.webview.html = getWebViewContent(comments);
        commentListPanel.onDidDispose(() => {
            commentListPanel = undefined;
        });
		commentListPanel.onDidChangeViewState((event) => {
			console.log("💡💡💡💡💡");
		});
		vscode.window.onDidChangeActiveTextEditor((e)=> {
			console.log(commentListPanel?.active);
			if(!commentListPanel?.active) {
				commentListPanel?.dispose();
			}
		});
		commentListPanel.webview.onDidReceiveMessage(message => {
			switch(message.command) {
				case 'delete': {
					deleteComment(message.text);
					vscode.window.showInformationMessage("Comment deleted!");
					// update html of comment 
					const updatedComments: { lineNumber: number; text: string; }[] = [];
					config.changedComments.forEach(comment => {
						if(comment.lineNumber != message.lineNumber) {
							updatedComments.push(comment);
						}
					});
					config.changedComments = updatedComments;
					if (updatedComments.length === 0) {
						commentListPanel?.dispose();
					}
					if(commentListPanel) commentListPanel.webview.html = getWebViewContent(updatedComments);
					return;
				}
				case 'keep': {
					keepComment(message.text);
					vscode.window.showInformationMessage("Saved changes!");
					const updatedComments: { lineNumber: number; text: string; }[] = [];
					config.changedComments.forEach(comment => {
						if(comment.lineNumber != message.lineNumber) {
							updatedComments.push(comment);
						}
					});
					config.changedComments = updatedComments;
					if (updatedComments.length === 0) {
						commentListPanel?.dispose();
					}
					if(commentListPanel) commentListPanel.webview.html = getWebViewContent(updatedComments);
					return;
				}
				case 'edit': {
					vscode.window.showInformationMessage("Edited comment!");
					editComment(message, commentController);
					keepComment(message.text);
					//updating webview
					const updatedComments: { lineNumber: number; text: string; }[] = [];
					config.changedComments.forEach(comment => {
						if(comment.lineNumber != message.lineNumber) {
							updatedComments.push(comment);
						}
					});
					config.changedComments = updatedComments;
					if (updatedComments.length === 0) {
						commentListPanel?.dispose();
					}
					if(commentListPanel) commentListPanel.webview.html = getWebViewContent(updatedComments);
					return;
				}
			}
		}, undefined, context.subscriptions); 
    }
}
  
function getWebViewContent(comments: { lineNumber: number; text: string; }[]) {
	let innerDivs = '';
	const keepButton = `<button onclick="keepComment(this)" class="btn keep-btn" style="color:#9DFFCA;"><i class="fa fa-check"></i></button>`;
	const editButton = `<button onclick="editComment(this)" class="btn edit-btn" style="color:#81B6F6;"><i class="fa fa-pencil"></i></button>`;
	const deleteButton = '<button onclick="deleteComment(this)" class="btn delete-btn" style="color:#FF9DB1;"><i class="fa fa-close"></i></button>';
	comments.forEach(comment => {
		innerDivs+=`<div class="comment">
			<div>
				Line
				<span>${comment.lineNumber}</span>
				-
				<span id="text">${comment.text}</span>
			</div>
			<div>
				${keepButton}
				${editButton}
				${deleteButton}
			</div>
			
		</div>`;
	});
    return `
        <!DOCTYPE html>
        <html>
		<head>
			<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
			<style>
			.comment {
				display: flex;
				flex-direction: row;
				justify-content: space-between;
				background-color:black;
				color: white;
				padding:20px;
			}
			.btn {
			  background-color: transparent;
			  border: none;
			  font-size: 16px;
			  cursor: pointer;
			}
			
			/* Darker background on mouse-over */
			.btn:hover {
			  background-color: transparent;
			  color: lightgrey;
			}
			</style>
		</head>
        <body>
            <h4>This file was edited after the comments were saved, please update the following comments accordingly:</h4>
		<div id="containerDiv">
			${innerDivs}
		</div>
		<script>
		const vscode = acquireVsCodeApi();
		function keepComment(buttonEl){
			const commentText = buttonEl.parentElement.previousElementSibling.lastElementChild.innerText;
			const commentLineNumber = buttonEl.parentElement.previousElementSibling.firstElementChild.innerText;
			vscode.postMessage({command: "keep", text: commentText, lineNumber: commentLineNumber });
		}
		function deleteComment(buttonEl){
			const commentText = buttonEl.parentElement.previousElementSibling.lastElementChild.innerText;
			const commentLineNumber = buttonEl.parentElement.previousElementSibling.firstElementChild.innerText; 
			vscode.postMessage({command: "delete", text: commentText, lineNumber: commentLineNumber });
		}
		function editComment(buttonEl){
			const commentText = buttonEl.parentElement.previousElementSibling.lastElementChild.innerText;
			const commentLineNumber = buttonEl.parentElement.previousElementSibling.firstElementChild.innerText; 
			vscode.postMessage({command: "edit", text: commentText, lineNumber: commentLineNumber });
		}
		</script>
        </body>
        </html>
    `;
}

function keepComment(commentText: string) {
	// from comment text find line number
	const content = fs.existsSync(config.commentJSONPath)
          ? JSON.parse(fs.readFileSync(config.commentJSONPath, "utf-8"))
          : {};
	for (const key in content) {
		if (content[key] === commentText) {
			const lineNumber = +key.split('-')[0];
			const codeLine = config.document?.lineAt(lineNumber-1).text || "";
			const newKey = lineNumber + "-" + btoa(codeLine);
			const value = content[key];
			delete content[key];
			content[newKey] = value;
			fs.writeFileSync(
				config.commentJSONPath,
				JSON.stringify(content, null, 2)
			);
			break;
		}
	}
}

function deleteComment(commentText: string) {
	console.log("🎲🎲🎲🎲🎲🎲🎲🎲", "here");
	const content = fs.existsSync(config.commentJSONPath)
          ? JSON.parse(fs.readFileSync(config.commentJSONPath, "utf-8"))
          : {};
	console.log("🎲🎲🎲🎲🎲🎲🎲🎲", content);
    for (const key in content) {
		console.log("🎲🎲🎲🎲🎲🎲🎲🎲 -- 1", content[key]);
		console.log("🎲🎲🎲🎲🎲🎲🎲🎲 -- 2", commentText);
      if (content[key] === commentText) {
		console.log("🎲🎲🎲🎲🎲🎲🎲🎲", content[key]);
        delete content[key];
        fs.writeFileSync(
          config.commentJSONPath,
          JSON.stringify(content, null, 2)
        );
        break;
      }
    }
}

function editComment(message: any, commentController: vscode.CommentController) {
	const newComment = new NewComment(
		message.text,
		message.lineNumber,
		vscode.CommentMode.Editing,
		{ name: " " }
	);
	const thread = commentController.createCommentThread(
	vscode.Uri.file(config.currentFilePath),
	new vscode.Range(message.lineNumber - 1, 0, message.lineNumber - 1, 0),
	[newComment]
	);
	thread.canReply = false;
	thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
	thread.label = " ";
	newComment.parent = thread;
}