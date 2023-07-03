/* eslint-disable prefer-const */
'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import { readFileSync, writeFileSync } from 'fs';
import path = require('path');

let commentId = 1;

class NewComment implements vscode.Comment {
	id: number;
	label: string | undefined;
	savedBody: string | vscode.MarkdownString; // for the Cancel button
	constructor(
		public body: string | vscode.MarkdownString,
		public line: number,
		public mode: vscode.CommentMode,
		public author: vscode.CommentAuthorInformation,
		public parent?: vscode.CommentThread,
		public contextValue?: string
	) {
		this.id = ++commentId;
		this.savedBody = this.body;
	}
}

export function activate(context: vscode.ExtensionContext) {
	
	//obtaining the file path
	const activeEditor = vscode.window.activeTextEditor;
	const folderName = (vscode.workspace.workspaceFolders !== undefined) ? vscode.workspace.workspaceFolders[0].name : ''; 
	const currentFilePath =  (activeEditor && activeEditor.document && activeEditor.document.fileName) ? 
		vscode.Uri.file(activeEditor.document.fileName.split(folderName)[1]).path : '';
	const newVar = activeEditor? activeEditor.document.fileName : '';
	const newStr = newVar.split(folderName).join(folderName+'\\.docs');

	// console.log(newStr+'.json');
	const dirData = {
		filePath: __dirname+'/../.docs'+currentFilePath+'.json',
		newPath: newStr+'.json',
		fullPath: activeEditor? activeEditor.document.fileName : ''
	};
	const commentController = vscode.comments.createCommentController('virtual-comment-system', 'Virtual Comment System');
	context.subscriptions.push(commentController);

	commentController.commentingRangeProvider = {
		provideCommentingRanges: (document: vscode.TextDocument, token: vscode.CancellationToken) => {
			const lineCount = document.lineCount;
			//changing filePath on tab change
			const currentFilePath = document.uri.path.split(folderName)[1];
			dirData.filePath = __dirname+'/../.docs'+currentFilePath+'.json';
			const newStr = document.uri.path.split(folderName);
			const newStr2 = path.join(newStr[0], folderName, '.docs', newStr[1]);
			
			dirData.fullPath = document.uri.path;
			dirData.newPath = newStr2+'.json';
			// console.log('tab change', dirData.newPath);
			commentProvider.dispose();
			commentProvider = showComments();
			return [new vscode.Range(0, 0, lineCount - 1, 0)];
		}
		
	};

	let commentProvider = showComments();
	context.subscriptions.push(vscode.commands.registerCommand('mywiki.addComment', (reply: vscode.CommentReply) => {
		const thread = reply.thread;
		thread.canReply = false;
		const newComment = new NewComment(reply.text, 0, vscode.CommentMode.Preview, { name: '' }, thread, thread.comments.length ? 'canDelete' : undefined);
		thread.label = ' ';
		newComment.label=' ';
		writeComment(newComment);
		thread.comments = [...thread.comments, newComment];
		commentProvider.dispose();
		commentProvider = showComments();
		thread.dispose();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('mywiki.deleteComment', (thread: vscode.CommentThread) => {
		const path = dirData.newPath.replace(/\\/g, '\\\\');
		const content = (fs.existsSync(path.slice(2))) ? JSON.parse(readFileSync(path.slice(2), 'utf-8')) : [];
		const index = content.findIndex((obj: { text: string | vscode.MarkdownString; }) => obj.text === thread.comments[0].body);
		if (index !== -1) {
			content.splice(index, 1);
		}
		fs.writeFileSync(path.slice(2), JSON.stringify(content, null, 2));
		thread.dispose();
		commentProvider.dispose();
		commentProvider = showComments();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('mywiki.cancelsaveComment', (comment: NewComment) => {
		if (!comment.parent) {
			return;
		}
		comment.parent.comments = comment.parent.comments.map(cmt => {
			if ((cmt as NewComment).id === comment.id) {
				cmt.body = (cmt as NewComment).savedBody;
				cmt.mode = vscode.CommentMode.Preview;
			}

			return cmt;
		});
		comment.parent.dispose();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('mywiki.saveComment', (comment: NewComment) => {
		comment.mode = vscode.CommentMode.Preview;
		editComment(comment);
		commentProvider.dispose();
		commentProvider = showComments();
		comment.parent?.dispose();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('mywiki.clickComment', (text: string, lineNumber: number) => {
		commentProvider.dispose();
		commentProvider = showComments();
		const newComment = new NewComment(text, lineNumber, vscode.CommentMode.Editing, { name: ' '});	
		const x = activeEditor? activeEditor.document.fileName : '';
		console.log('editing', dirData.fullPath);
		const thread = commentController.createCommentThread(vscode.Uri.file(dirData.fullPath), new vscode.Range(lineNumber - 1, 0, lineNumber - 1, 0),  [newComment]);
		thread.canReply = false;
		thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
		thread.label = ' ';
		newComment.parent = thread;
	}));

	function showComments() {
		const path = dirData.newPath.replace(/\\/g, '\\\\');
		const content = (fs.existsSync(path.slice(2))) ? JSON.parse(readFileSync(path.slice(2), 'utf-8')) : [];
		// console.log(content);
		return vscode.languages.registerCodeLensProvider({ scheme: 'file' }, {
			provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens[]> {
			const codeLenses: vscode.CodeLens[] = [];
			const existingCodeLensRanges: vscode.Range[] = [];
    
			// Iterate over existing CodeLenses and store their ranges
			for (const codeLens of codeLenses) {
			existingCodeLensRanges.push(codeLens.range);
			}
			const lineNumbers: number[] = [];
			for (const entry of content) {
				const range = new vscode.Range(entry.lineNumber - 1, 0, entry.lineNumber - 1, 0);
				if (!existingCodeLensRanges.some(existingRange => existingRange.contains(range))) {
				const command: vscode.Command = {
				title: entry.text,
				command: 'mywiki.clickComment', 
				tooltip: entry.text.replace(/(?:\r\n|\r|\n)/g, '\n'), 
				arguments: [
					entry.text,
					entry.lineNumber
				]
			};
				const codeLens = new vscode.CodeLens(range, command);
				codeLenses.push(codeLens);
			}}
			return codeLenses;
			}
		});
	}

	function writeComment(newComment: NewComment) {
		
		//get line number and comment
		const lineNo = newComment.parent? newComment.parent.range.start.line+1 : newComment.line;
		//comment object
		const commentObj = [{
			lineNumber: lineNo,
			text: newComment.body,
		}];
		// Read the existing data from the file
		let existingData: any[] = [];
		const path = dirData.newPath.replace(/\\/g, '\\\\');
		// console.log(dirData.fullPath);
		// console.log('path', path);
		const separatingIndex = path.lastIndexOf('\\\\');
		const p1 =  path.slice(2,separatingIndex);
		//case: file already exists
		if (fs.existsSync(path.slice(2))) {
			// console.log('file exists');
			const fileContent = fs.readFileSync(path.slice(2), 'utf8');
			existingData = JSON.parse(fileContent);
		}
		// Append new data to existing data
		const updatedData = [...existingData, ...commentObj];
		// Write the updated data to the file
		const jsonContent = JSON.stringify(updatedData, null, 2);
		// const separatingIndex = path.lastIndexOf('\\\\');
		// const p1 =  path.slice(2,separatingIndex);
		try {
			fs.mkdirSync(p1, { recursive: true });
			// console.log('directory created');
		} catch (e) {
			console.log(e);
		}
		// console.log(path.slice(2));
		writeFileSync(path.slice(2), jsonContent, 'utf8');
	}

	function editComment(newComment: NewComment) {
		let existingData: any[] = [];
		//case: file already exists
		const path = dirData.newPath.replace(/\\/g, '\\\\');
		if (fs.existsSync(path.slice(2))) {
			const fileContent = fs.readFileSync(path.slice(2), 'utf8');
			existingData = JSON.parse(fileContent);
		}
		const matchingObject = existingData.find((obj: { lineNumber: number }) => obj.lineNumber === newComment.line);
		if (matchingObject) {
			matchingObject.text = newComment.body;
			fs.writeFileSync(path.slice(2), JSON.stringify(existingData, null, 2));
		} 
	}
}