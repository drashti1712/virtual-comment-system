/* eslint-disable no-mixed-spaces-and-tabs */
'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import { readFileSync, writeFileSync } from 'fs';

let commentId = 1;

class NoteComment implements vscode.Comment {
	id: number;
	label: string | undefined;
	savedBody: string | vscode.MarkdownString; // for the Cancel button
	constructor(
		public body: string | vscode.MarkdownString,
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
	console.log('ACTIVATING....');
	//obtaining the file path
	const activeEditor = vscode.window.activeTextEditor;
	const folderName = (vscode.workspace.workspaceFolders !== undefined) ? vscode.workspace.workspaceFolders[0].name : ''; 
	const currentFilePath =  (activeEditor && activeEditor.document && activeEditor.document.fileName) ? 
		vscode.Uri.file(activeEditor.document.fileName.split(folderName)[1]).path : '';
	const currentFile = {
		currentDir: __dirname+'/../.docs'+currentFilePath
	};

	const commentController = vscode.comments.createCommentController('comment-sample', 'Comment API Sample');
	context.subscriptions.push(commentController);

	commentController.commentingRangeProvider = {
		provideCommentingRanges: (document: vscode.TextDocument, token: vscode.CancellationToken) => {
			const lineCount = document.lineCount;
			//changing filePath on tab change
			const filePath = document.uri.path.split(folderName)[1];
			currentFile.currentDir = __dirname+'/../.docs'+filePath;
			return [new vscode.Range(0, 0, lineCount - 1, 0)];
		}
		
	};

	context.subscriptions.push(vscode.commands.registerCommand('mywiki.createNote', (reply: vscode.CommentReply) => {
		
		replyNote(reply);
	}));

	context.subscriptions.push(vscode.commands.registerCommand('mywiki.getComments', () => {
		vscode.window.showInformationMessage('Comments are coming!!');
		const content = JSON.parse(readFileSync(currentFile.currentDir+'.json', 'utf-8'));
		console.log(content);

		//show comments
		vscode.languages.registerCodeLensProvider({ scheme: 'file' }, {
			provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens[]> {
			  const codeLenses: vscode.CodeLens[] = [];
		  
			  // Create a CodeLens for each line where you want to display the text
			  const lineNumbers: number[] = [];
			  for (const entry of content) {
				const range = new vscode.Range(entry.lineNumber - 1, 0, entry.lineNumber - 1, 0);
				const command: vscode.Command = {
				  title: entry.text, // Text to be displayed
				  command: '', // Command to execute when the CodeLens is clicked
				  tooltip: 'Click to perform an action', // Optional tooltip
				};
				const codeLens = new vscode.CodeLens(range, command);
				codeLenses.push(codeLens);
			  }
			  return codeLenses;
			},
		  });
		  
	}));

	context.subscriptions.push(vscode.commands.registerCommand('mywiki.replyNote', (reply: vscode.CommentReply) => {
		replyNote(reply);
	}));

	context.subscriptions.push(vscode.commands.registerCommand('mywiki.startDraft', (reply: vscode.CommentReply) => {
		const thread = reply.thread;
		thread.contextValue = 'draft';
		const newComment = new NoteComment(reply.text, vscode.CommentMode.Preview, { name: 'vscode' }, thread);
		newComment.label = 'pending';
		thread.comments = [...thread.comments, newComment];
	}));

	context.subscriptions.push(vscode.commands.registerCommand('mywiki.finishDraft', (reply: vscode.CommentReply) => {
		const thread = reply.thread;

		if (!thread) {
			return;
		}

		thread.contextValue = undefined;
		thread.collapsibleState = vscode.CommentThreadCollapsibleState.Collapsed;
		if (reply.text) {
			const newComment = new NoteComment(reply.text, vscode.CommentMode.Preview, { name: 'vscode' }, thread);
			thread.comments = [...thread.comments, newComment].map(comment => {
				comment.label = undefined;
				return comment;
			});
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('mywiki.deleteNoteComment', (comment: NoteComment) => {
		const thread = comment.parent;
		if (!thread) {
			return;
		}

		thread.comments = thread.comments.filter(cmt => (cmt as NoteComment).id !== comment.id);

		if (thread.comments.length === 0) {
			thread.dispose();
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('mywiki.deleteNote', (thread: vscode.CommentThread) => {
		thread.dispose();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('mywiki.cancelsaveNote', (comment: NoteComment) => {
		if (!comment.parent) {
			return;
		}

		comment.parent.comments = comment.parent.comments.map(cmt => {
			if ((cmt as NoteComment).id === comment.id) {
				cmt.body = (cmt as NoteComment).savedBody;
				cmt.mode = vscode.CommentMode.Preview;
			}

			return cmt;
		});
	}));

	context.subscriptions.push(vscode.commands.registerCommand('mywiki.saveNote', (comment: NoteComment) => {
		if (!comment.parent) {
			return;
		}

		comment.parent.comments = comment.parent.comments.map(cmt => {
			if ((cmt as NoteComment).id === comment.id) {
				(cmt as NoteComment).savedBody = cmt.body;
				// console.log(cmt);
				cmt.mode = vscode.CommentMode.Preview;
			}

			return cmt;
		});
	}));

	context.subscriptions.push(vscode.commands.registerCommand('mywiki.editNote', (comment: NoteComment) => {
		if (!comment.parent) {
			return;
		}

		comment.parent.comments = comment.parent.comments.map(cmt => {
			if ((cmt as NoteComment).id === comment.id) {
				cmt.mode = vscode.CommentMode.Editing;
			}

			return cmt;
		});
	}));

	context.subscriptions.push(vscode.commands.registerCommand('mywiki.dispose', () => {
		commentController.dispose();
	}));

	function replyNote(reply: vscode.CommentReply) {
		const thread = reply.thread;
		const newComment = new NoteComment(reply.text, vscode.CommentMode.Preview, { name: 'vscode' }, thread, thread.comments.length ? 'canDelete' : undefined);
		//get line number and comment
		const lineNumber = newComment.parent?.range.start.line || 0;
		//comment object
		const commentObj = [{
			lineNumber: lineNumber+1,
			comment: reply.text,
		}];
		console.log(commentObj);
		//new write
		//-----
		// Read the existing data from the file
		let existingData: any[] = [];
		const dir = currentFile.currentDir;
		const filePath = dir +'.json';
		if (fs.existsSync(filePath)) {
		  const fileContent = fs.readFileSync(filePath, 'utf8');
		  existingData = JSON.parse(fileContent);
		}

		// Append new data to existing data
		const updatedData = [...existingData, ...commentObj];

		// Write the updated data to the file
		const jsonContent = JSON.stringify(updatedData, null, 2);
		fs.writeFileSync(filePath, jsonContent, 'utf8');
		//-----
		//write obj to file
		// const dir = currentFile.currentDir;
		// writeFileSync(dir+'.json', JSON.stringify(commentObj), {
		// 		flag: 'w',
		// });
		// vscode.workspace.fs.writeFile(vscode.Uri.file(dir + '.json'), Uint8Array.from(commentObj	));
		if (thread.contextValue === 'draft') {
			newComment.label = 'pending';
		}

		thread.comments = [...thread.comments, newComment];
	}

	function getCurrentLineNumber() {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const position = editor.selection.active;
			// console.log('new line number: ', position.line);
			return position.line + 1; // Adding 1 because line numbers start from 0
		}
		return 0; // Return 0 if no active editor or selection
	}
	// Example usage
	// const lineNumber = getCurrentLineNumber();
	// console.log('Current line number:', lineNumber);
}