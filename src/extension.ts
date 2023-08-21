"use strict";

import * as vscode from "vscode";
import * as fs from "fs";
import path = require("path");
import { isSnippet, extractFirstLine, getSnippet } from "./snippet";
import { config, lineConfig } from "./path";

let commentId = 1;

class NewComment implements vscode.Comment {
  id: number;
  label: string | undefined;
  savedBody: string | vscode.MarkdownString;
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
    this.label = " ";
  }
}

export function activate(context: vscode.ExtensionContext) {
  const commentController = vscode.comments.createCommentController(
    "virtual-comment-system",
    "Virtual Comment System"
  );
  context.subscriptions.push(commentController);

  commentController.commentingRangeProvider = {
    provideCommentingRanges: (
      document: vscode.TextDocument
    ) => {
      return [new vscode.Range(0, 0, document.lineCount - 1, 0)];
    },
  };

  commentController.options = {
    placeHolder: "Type a new comment or add a snippet",
    prompt: " ",
  };

  let commentProvider = showComments();

  vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
    // when you change text editor range
  });

  vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
	//modify lines and show codelens - 1
	console.log("saved!!", document.lineCount);
	const newLC = document.lineCount;
	if(lineConfig.originalLC === newLC) {
		console.log("No changes!!");
	} else {
		lineConfig.buffer = lineConfig.originalLC - newLC;
		lineConfig.originalLC = newLC;
	}
	commentProvider = showComments();
  });

  vscode.workspace.onDidChangeTextDocument((event) => {
	//disable codelens - 2
	commentProvider.dispose();
	const editedDocument = event.document;
  const editedLine = editedDocument.lineAt(event.contentChanges[0].range.start);
  const editedLineNumber = editedLine.lineNumber;
	lineConfig.editedLine = editedLineNumber+1;
  console.log(`Edited line number: ${editedLineNumber+1}`);
  });

  vscode.window.onDidChangeActiveTextEditor((event) => {
    if (!event) return;
    //changing filePath on tab change
    const newStr = event.document.uri.path.split(config.folderName);
    const newStr2 = path.join(newStr[0], config.folderName, ".docs", newStr[1]);

    config.currentFilePath = event.document.uri.path;
    config.commentJSONPath = (newStr2 + ".json")
      .replace(/\\/g, "\\\\")
      .slice(2);
    
	//changing buffer, editedLineNumber, originalLC
    lineConfig.originalLC = event.document.lineCount;
	lineConfig.buffer = 0;
	lineConfig.editedLine = -1;
    console.log("Text editor changed", lineConfig.originalLC, lineConfig.buffer);

	commentProvider.dispose();
    commentProvider = showComments();
  });

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "mywiki.addComment",
      (reply: vscode.CommentReply) => {
        const thread = reply.thread;
        thread.canReply = false;
        thread.label = " ";
        const newComment = new NewComment(
          reply.text,
          thread.range.start.line + 1,
          vscode.CommentMode.Preview,
          { name: "" },
          thread,
          undefined
        );
        newComment.label = " ";
        writeToFile(newComment);
        thread.comments = [...thread.comments, newComment];
        commentProvider.dispose();
        commentProvider = showComments();
        thread.dispose();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "mywiki.addSnippet",
      (reply: vscode.CommentReply) => {
        const lineNo = reply.thread.range.start.line;
        const lineText = config.document?.lineAt(lineNo).text;
        const snippet = getSnippet(lineText);
        reply.thread.canReply = false;
        reply.thread.label = " ";
        const newComment = new NewComment(
          snippet,
          lineNo + 1,
          vscode.CommentMode.Editing,
          { name: " " }
        );
        reply.thread.comments = [...reply.thread.comments, newComment];
        newComment.parent = reply.thread;
        newComment.contextValue = "snippet";
        newComment.label = " ";
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "mywiki.deleteComment",
      (thread: vscode.CommentThread) => {
        const content = fs.existsSync(config.commentJSONPath)
          ? JSON.parse(fs.readFileSync(config.commentJSONPath, "utf-8"))
          : [];
        const index = content.findIndex(
          (obj: { text: string | vscode.MarkdownString }) =>
            obj.text === thread.comments[0].body
        );
        if (index !== -1) {
          content.splice(index, 1);
        }
        fs.writeFileSync(
          config.commentJSONPath,
          JSON.stringify(content, null, 2)
        );
        thread.dispose();
        commentProvider.dispose();
        commentProvider = showComments();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "mywiki.cancelsaveComment",
      (comment: NewComment) => {
        if (!comment.parent) {
          return;
        }
        comment.parent.comments = comment.parent.comments.map((cmt) => {
          if ((cmt as NewComment).id === comment.id) {
            cmt.body = (cmt as NewComment).savedBody;
            cmt.mode = vscode.CommentMode.Preview;
          }

          return cmt;
        });
        comment.parent.dispose();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "mywiki.saveComment",
      (comment: NewComment) => {
        comment.mode = vscode.CommentMode.Preview;
        if (comment.contextValue === "snippet") {
          writeToFile(comment);
        } else {
          editComment(comment);
        }
        commentProvider.dispose();
        commentProvider = showComments();
        comment.parent?.dispose();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "mywiki.clickComment",
      (text: string, lineNumber: number) => {
        commentProvider.dispose();
        commentProvider = showComments();
        const newComment = new NewComment(
          text,
          lineNumber,
          vscode.CommentMode.Editing,
          { name: " " }
        );
        const thread = commentController.createCommentThread(
          vscode.Uri.file(config.currentFilePath),
          new vscode.Range(lineNumber - 1, 0, lineNumber - 1, 0),
          [newComment]
        );
        thread.canReply = false;
        thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
        thread.label = " ";
        newComment.parent = thread;
      }
    )
  );

  function showComments() {
	console.log('lineConfig', lineConfig);
    const content = fs.existsSync(config.commentJSONPath)
      ? JSON.parse(fs.readFileSync(config.commentJSONPath, "utf-8"))
      : [];
	console.log(content);
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
          for (const entry of content) {
			//add logic to set new line number
			if(lineConfig.buffer !== 0 && entry.lineNumber> (lineConfig.editedLine+lineConfig.buffer)) {
				entry.lineNumber = entry.lineNumber - lineConfig.buffer;
				//modify line Number in json file
			}
			//original code
            const commentText = entry.text;
            const range = new vscode.Range(
              entry.lineNumber - 1,
              0,
              entry.lineNumber - 1,
              0
            );
            if (
              !existingCodeLensRanges.some((existingRange) =>
                existingRange.contains(range)
              )
            ) {
              const command: vscode.Command = {
                title: isSnippet(commentText)
                  ? extractFirstLine(commentText)
                  : commentText,
                command: "mywiki.clickComment",
                tooltip: commentText.replace(/(?:\r\n|\r|\n)/g, "\n"),
                arguments: [commentText, entry.lineNumber],
              };
              const codeLens = new vscode.CodeLens(range, command);
              codeLenses.push(codeLens);
            }
          }
		// console.log("Content", content);
		//writing modified data back
		const jsonContent = JSON.stringify(content, null, 2);
		fs.writeFileSync(config.commentJSONPath, jsonContent, "utf-8");
          return codeLenses;
        },
      }
    );
  }

  function writeToFile(newComment: NewComment) {
    const lineNo = newComment.parent
      ? newComment.parent.range.start.line + 1
      : newComment.line;
    const commentObj = [
      {
        lineNumber: lineNo,
        text: newComment.body,
      },
    ];
    // Read the existing data from the file
    let existingData: any[] = [];
    const folderPath = config.commentJSONPath;
    const separatingIndex = folderPath.lastIndexOf("\\\\");
    const p1 = folderPath.slice(0, separatingIndex);
    //case: file already exists
    if (fs.existsSync(folderPath)) {
      const fileContent = fs.readFileSync(folderPath, "utf8");
      existingData = JSON.parse(fileContent);
    }
    const updatedData = [...existingData, ...commentObj];
    const jsonContent = JSON.stringify(updatedData, null, 2);
    try {
      fs.mkdirSync(p1, { recursive: true });
    } catch (e) {
      console.log(e);
    }
    fs.writeFileSync(folderPath, jsonContent, "utf8");
  }

  function editComment(newComment: NewComment) {
    let existingData: any[] = [];
    //case: file already exists
    if (fs.existsSync(config.commentJSONPath)) {
      const fileContent = fs.readFileSync(config.commentJSONPath, "utf8");
      existingData = JSON.parse(fileContent);
    }
    const matchingObject = existingData.find(
      (obj: { lineNumber: number }) => obj.lineNumber === newComment.line
    );
    if (matchingObject) {
      matchingObject.text = newComment.body;
      fs.writeFileSync(
        config.commentJSONPath,
        JSON.stringify(existingData, null, 2)
      );
    }
  }
}
