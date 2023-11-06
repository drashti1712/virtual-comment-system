import * as vscode from 'vscode';
import * as fs from "fs";
import { config } from "../config";
import { NewComment } from '../extension';

export async function keepComment(commentText: string) {
	// from comment text find line number
	const content = JSON.parse((await fs.promises.readFile(config.commentJSONPath)).toString()) || {};
	for (const key in content) {
		if (content[key] === commentText) {
			const lineNumber = +key.split('-')[0];
			const codeLine = config.document?.lineAt(lineNumber - 1).text || "";
			const newKey = lineNumber + "-" + btoa(codeLine);
			const value = content[key];
			delete content[key];
			content[newKey] = value;
			fs.promises.writeFile(config.commentJSONPath,
				JSON.stringify(content, null, 2));
			break;
		}
	}
}

export async function deleteComment(commentText: string) {
	const content = JSON.parse((await fs.promises.readFile(config.commentJSONPath)).toString()) || {};
	for (const key in content) {
		if (content[key] === commentText) {
			delete content[key];
			fs.promises.writeFile(
				config.commentJSONPath,
				JSON.stringify(content, null, 2)
			);
			break;
		}
	}
}

export function editComment(message: any, commentController: vscode.CommentController) {
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

