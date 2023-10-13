"use strict";

import * as vscode from "vscode";
import * as fs from "fs";
import path = require("path");
import { getSnippet } from "./snippet";
import { config } from "./config";
import { showComments, lineChangeFlag } from "./showComments";
import showCommentListPanel from "./webView/webViewPanel";
import editComment from "./editComment";

let commentId = 1;
const commentThreadPool: vscode.CommentThread[] = [];
let currentActiveFile: vscode.Uri | null = null;
export class NewComment implements vscode.Comment {
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
  const commentController = vscode.comments.createCommentController("virtual-comment-system", "Virtual Comment System");
  context.subscriptions.push(commentController);

  commentController.commentingRangeProvider = {
    provideCommentingRanges: (document: vscode.TextDocument) => {
      return [new vscode.Range(0, 0, document.lineCount - 1, 0)];
    },
  };

  commentController.options = {
    placeHolder: "Type a new comment or add a snippet",
    prompt: " ",
  };

  showCommentThread();
  let commentProvider = showComments();

  vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
    commentProvider = showComments();
  });

  vscode.workspace.onDidChangeTextDocument((event) => {
    commentProvider.dispose();
  });

  vscode.window.onDidChangeActiveTextEditor((event) => {
    if (!event) return;
    if (event.document.uri.scheme === 'file' && currentActiveFile?.path !== event?.document.uri.path && !event.document.uri.path.includes('commentinput-1')) {
      currentActiveFile = event?.document.uri;
      console.log(event.selection.active.line);
      const newStr = event.document.uri.path.split(config.folderName);
      const newStr2 = path.join(newStr[0], config.folderName, ".docs", newStr[1]);
      config.currentFilePath = event.document.uri.path;
      config.commentJSONPath = (newStr2 + ".json");
      config.document = vscode.window.activeTextEditor?.document;
      config.folderName = vscode.workspace.workspaceFolders !== undefined ? vscode.workspace.workspaceFolders[0].name : "";
      config.fileName = newStr2.slice(newStr2.lastIndexOf('/') + 1, newStr2.length);
      commentProvider.dispose();
      disposeAllCommentThreads();
      showCommentThread();
      commentProvider = showComments();
    }
  });
  context.subscriptions.push(vscode.commands.registerCommand('mywiki.showCommentThread', (event: vscode.Command) => {
    showCommentThread();
    showComments();
  }));

  context.subscriptions.push(vscode.commands.registerCommand('mywiki.disposeCommentThread', (event: vscode.Command) => {
    disposeAllCommentThreads();
  }));

  context.subscriptions.push(vscode.commands.registerCommand('mywiki.showCommentNotifications', () => {
    if (!lineChangeFlag && config.changedComments.length !== 0) {
      showCommentListPanel(config.changedComments, context, commentController);
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand("mywiki.addComment", (reply: vscode.CommentReply) => {
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

  context.subscriptions.push(vscode.commands.registerCommand("mywiki.addSnippet", (reply: vscode.CommentReply) => {
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

  context.subscriptions.push(vscode.commands.registerCommand("mywiki.deleteComment", (thread: vscode.CommentThread) => {
    const content = fs.existsSync(config.commentJSONPath)
      ? JSON.parse(fs.readFileSync(config.commentJSONPath, "utf-8"))
      : {};
    for (const key in content) {
      if (content[key] === thread.comments[0].body) {
        delete content[key];
        fs.writeFileSync(
          config.commentJSONPath,
          JSON.stringify(content, null, 2)
        );
        break;
      }
    }
    thread.dispose();
    commentProvider.dispose();
    commentProvider = showComments();
  }
  )
  );

  context.subscriptions.push(vscode.commands.registerCommand("mywiki.cancelsaveComment", (comment: NewComment) => {
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

  context.subscriptions.push(vscode.commands.registerCommand("mywiki.saveComment", (comment: NewComment) => {
    comment.mode = vscode.CommentMode.Preview;
    if (comment.contextValue === "snippet") {
      writeToFile(comment);
    } else {
      editComment(comment);
    }
    disposeAllCommentThreads();
    commentProvider.dispose();
    showCommentThread();
    commentProvider = showComments();
    comment.parent?.dispose();
  }
  )
  );

  context.subscriptions.push(vscode.commands.registerCommand("mywiki.clickComment", (text: string, lineNumber: number) => {
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

  function createCommentObject(key: string, value: string): Record<string, string> {
    const obj: Record<string, string> = {};
    obj[key] = value;
    return obj;
  }

  function writeToFile(newComment: NewComment) {
    const lineNo = newComment.parent
      ? newComment.parent.range.start.line + 1
      : newComment.line;
    const lineText = config.document?.lineAt(lineNo - 1).text || '';
    const commentObj = createCommentObject(lineNo + "-" + btoa(lineText), newComment.body.toString());
    // Read the existing data from the file
    let existingData: any[] = [];
    const folderPath = config.commentJSONPath;
    const separatingIndex = folderPath.lastIndexOf("/");
    const p1 = folderPath.slice(0, separatingIndex);
    //case: file already exists
    if (fs.existsSync(folderPath)) {
      const fileContent = fs.readFileSync(folderPath, "utf8");
      existingData = JSON.parse(fileContent);
    }

    const updatedData = { ...existingData, ...commentObj };
    const jsonContent = JSON.stringify(updatedData, null, 2);
    try {
      fs.mkdirSync(p1, { recursive: true });
    } catch (e) {
      console.log(e);
    }
    fs.writeFileSync(folderPath, jsonContent, "utf8");
  }

  function disposeAllCommentThreads() {
    for (const thread of commentThreadPool) {
      thread.dispose();
    }
  }
  function showCommentThread() {
    if (vscode.window.activeTextEditor?.document.uri) {
      //load all comments for this file
      const comments = fs.existsSync(config.commentJSONPath) ? JSON.parse(fs.readFileSync(config.commentJSONPath, "utf-8")) : {};
      console.log("file comments", comments);
      for (const key in comments) {
        const value = comments[key];
        //parsing the key to get line number
        const lineNumber = +key.split('-')[0];
        const lineText = atob(key.split('-')[1]);
        console.log([lineNumber, lineText, value]);
        console.log("current active files", currentActiveFile);
        console.log("active txt editor", vscode.window.activeTextEditor.document.uri);
        const commentThread = commentController.createCommentThread(currentActiveFile || vscode.window.activeTextEditor.document.uri, new vscode.Range(lineNumber - 1, 0, lineNumber - 1, 0), []);
        commentThread.collapsibleState = vscode.CommentThreadCollapsibleState.Collapsed;
        const myNewComment = new NewComment(value, lineNumber, vscode.CommentMode.Preview,
          { name: "" },
          commentThread,
          "what's a context value!"
        );
        commentThread.comments = [myNewComment];
        commentThreadPool.push(commentThread);
      }
    }
  }
}
