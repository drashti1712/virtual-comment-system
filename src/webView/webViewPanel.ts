import * as vscode from 'vscode';
import * as fs from "fs";
import { config } from "../config";
import { NewComment } from '../extension';
import { getWebViewContent } from './htmlContent';

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
		vscode.window.onDidChangeActiveTextEditor((e)=> {
			if(!commentListPanel?.active) {
				commentListPanel?.dispose();
			}
		});
		commentListPanel.webview.onDidReceiveMessage(message => {
			switch(message.command) {
				case 'delete': {
					deleteComment(message.text);
					vscode.window.showInformationMessage("Comment deleted!");
					updateChangedComments(message);
					return;
				}
				case 'keep': {
					keepComment(message.text);
					vscode.window.showInformationMessage("Saved changes!");
					updateChangedComments(message);
					return;
				}
				case 'edit': {
					editComment(message, commentController);
					keepComment(message.text);
					updateChangedComments(message);
					return;
				}
			}
		}, undefined, context.subscriptions); 
    }
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
	const content = fs.existsSync(config.commentJSONPath)
          ? JSON.parse(fs.readFileSync(config.commentJSONPath, "utf-8"))
          : {};
    for (const key in content) {
      if (content[key] === commentText) {
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

function updateChangedComments(message: any) {
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
}