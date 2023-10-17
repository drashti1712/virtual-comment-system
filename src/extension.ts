"use strict";

import * as fs from "fs";
import path = require("path");
import * as vscode from "vscode";
import { config } from "./config";
import { languages } from 'vscode';
import { getSnippet } from "./snippet";
import editComment from "./editComment";
import { CodelensProvider } from "./codeLensProvider";
import showCommentListPanel from "./webView/webViewPanel";


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
  const codelensProvider = new CodelensProvider();
  languages.registerCodeLensProvider({ scheme: "file" }, codelensProvider);

  vscode.window.tabGroups.onDidChangeTabs((tabChangeEvent: any) => {
    // If tabs are closed no longer track their activity
    disposeAllCommentThreads();
    showCommentThread(tabChangeEvent?.changed[0].input.uri || undefined);
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
    }
  });

  context.subscriptions.push(vscode.commands.registerCommand('mywiki.showCommentNotifications', () => {
    if (!codelensProvider.lineChangeFlag && config.changedComments.length !== 0) {
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
    disposeAllCommentThreads();
    showCommentThread();
    codelensProvider.docChanged();
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

  context.subscriptions.push(vscode.commands.registerCommand("mywiki.deleteComment", (comment: NewComment) => {
    const content = fs.existsSync(config.commentJSONPath)
      ? JSON.parse(fs.readFileSync(config.commentJSONPath, "utf-8"))
      : {};
    for (const key in content) {
      if (content[key] === comment.body) {
        delete content[key];
        fs.writeFileSync(
          config.commentJSONPath,
          JSON.stringify(content, null, 2)
        );
        break;
      }
    }
    comment.parent?.dispose();
    codelensProvider.docChanged();
    disposeAllCommentThreads();
    showCommentThread();
  }
  )
  );

  context.subscriptions.push(vscode.commands.registerCommand("mywiki.cancelsaveComment", (comment: NewComment) => {
    if (!comment.parent) {
      return;
    }
    /*comment.parent.comments = comment.parent.comments.map((cmt) => {
      if ((cmt as NewComment).id === comment.id) {
        cmt.body = (cmt as NewComment).savedBody;
        cmt.mode = vscode.CommentMode.Preview;
      }
      return cmt;
    });*/
    comment.parent.dispose();
    disposeAllCommentThreads();
    showCommentThread();
  }));

  context.subscriptions.push(vscode.commands.registerCommand("mywiki.saveComment", (comment: NewComment) => {
    comment.mode = vscode.CommentMode.Preview;
    if (comment.contextValue === "snippet") {
      writeToFile(comment);
    } else {
      editComment(comment);
    }
    disposeAllCommentThreads();
    showCommentThread();
    codelensProvider.docChanged();
    comment.parent?.dispose();
  }));

  context.subscriptions.push(vscode.commands.registerCommand("mywiki.clickComment", (text: string, lineNumber: number) => {
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
    console.log("dispoosing all comment threads");
    for (const thread of commentThreadPool) {
      thread.dispose();
    }
  }
  function showCommentThread(path: vscode.Uri | undefined = undefined) {
    try {
      const currentFilePath = path?.path || currentActiveFile?.path || vscode.window.activeTextEditor?.document.uri.path;
      if (currentFilePath) {
        const workspaceFolderName = vscode.workspace.workspaceFolders !== undefined ? vscode.workspace.workspaceFolders[0].name : "";
        const pathSplit = currentFilePath.split(workspaceFolderName);
        pathSplit[1] = "/.docs" + pathSplit[1] + ".json";
        const jsonPath = pathSplit.join(workspaceFolderName);
        const comments = fs.existsSync(jsonPath) ? JSON.parse(fs.readFileSync(jsonPath, "utf-8")) : {};
        for (const key in comments) {
          const value = comments[key];
          //parsing the key to get line number
          const lineNumber = +key.split('-')[0];
          const uri = <vscode.Uri>path || currentActiveFile || vscode.window.activeTextEditor?.document.uri;
          const commentThread = commentController.createCommentThread(uri, new vscode.Range(lineNumber - 1, 0, lineNumber - 1, 0), []);
          commentThread.canReply = false;
          commentThread.collapsibleState = vscode.CommentThreadCollapsibleState.Collapsed;
          const myNewComment = new NewComment(value, lineNumber, vscode.CommentMode.Editing,
            { name: "" },
            commentThread,
            "what's a context value!"
          );
          commentThread.comments = [myNewComment];
          commentThreadPool.push(commentThread);
        }
      }
    } catch (error) {
      console.error(error);
    }
  }
}