import * as vscode from 'vscode';
import { config } from "../config";
import { getWebViewContent } from './htmlContent';
import { keepComment, deleteComment, editComment } from './utils';

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
		vscode.window.onDidChangeActiveTextEditor((e) => {
			if (!commentListPanel?.active) {
				commentListPanel?.dispose();
			}
		});
		commentListPanel.webview.onDidReceiveMessage(message => {
			switch (message.command) {
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

function updateChangedComments(message: any) {
	const updatedComments: { lineNumber: number; text: string; }[] = [];
	config.changedComments.forEach(comment => {
		if (comment.lineNumber != message.lineNumber) {
			updatedComments.push(comment);
		}
	});
	config.changedComments = updatedComments;
	if (updatedComments.length === 0) {
		commentListPanel?.dispose();
	}
	if (commentListPanel) commentListPanel.webview.html = getWebViewContent(updatedComments);
}

