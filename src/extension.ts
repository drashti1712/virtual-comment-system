"use strict";

import * as fs from "fs";
import path = require("path");
import * as vscode from "vscode";
import { config } from "./config";
import { getSnippet } from "./snippet";
import editComment from "./editComment";
import { CodelensProvider } from "./codeLensProvider";
import showCommentListPanel from "./webView/webViewPanel";


let commentId = 1;
const commentThreadPool: vscode.CommentThread[] = [];
let currentActiveFile: vscode.Uri | null = null;
const commentController = vscode.comments.createCommentController("virtual-comment-system", "Virtual Comment System");
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
  public static async showCommentThread(path: vscode.Uri | undefined = undefined) {
    try {
      const currentFilePath = path?.path || currentActiveFile?.path || vscode.window.activeTextEditor?.document.uri.path;
      if(currentFilePath?.includes('.json')) return;
      if (currentFilePath) {
        const workspaceFolderName = vscode.workspace.workspaceFolders !== undefined ? vscode.workspace.workspaceFolders[0].name : "";
        const pathSplit = currentFilePath.split(workspaceFolderName);
        pathSplit[1] = "/.docs" + pathSplit[1] + ".json";
        const jsonPath = pathSplit.join(workspaceFolderName);
        const document = await vscode.workspace.openTextDocument(currentFilePath);
        const comments = fs.existsSync(jsonPath) ? JSON.parse((fs.readFileSync(jsonPath)).toString()) : {};
        for (const key in comments) {
          const value = comments[key];
          const lineNumber = +key.split('-')[0];
          const lineTextInDoc = document.lineAt(lineNumber-1).text;
          const lineTextInJson = key.split('-')[1];
          if (lineTextInJson === '' && lineTextInDoc !== lineTextInJson) {
            continue;
          }
          const uri = <vscode.Uri>path || currentActiveFile || vscode.window.activeTextEditor?.document.uri;
          const commentThread = commentController.createCommentThread(uri, new vscode.Range(lineNumber - 1, 0, lineNumber - 1, 0), []);
          commentThread.canReply = false;
          commentThread.collapsibleState = vscode.CommentThreadCollapsibleState.Collapsed;
          const myNewComment = new NewComment(value, lineNumber, vscode.CommentMode.Preview,
            { name: "" },
            commentThread,
            ""
          );
          commentThread.comments = [myNewComment];
          commentThreadPool.push(commentThread);
        }
      }
    } catch (error) {
      vscode.window.showWarningMessage(<string>error);
      console.error("No JSON FILE for this file", error);
    }
  }

  public static disposeAllCommentThreads() {
    for (const thread of commentThreadPool) {
      thread.dispose();
    }
  }
}

export function activate(context: vscode.ExtensionContext) {
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
  NewComment.showCommentThread();

  const codelensProvider = new CodelensProvider();
  vscode.languages.registerCodeLensProvider({ scheme: "file" }, codelensProvider);

  vscode.window.tabGroups.onDidChangeTabs((tabChangeEvent: any) => {
    NewComment.disposeAllCommentThreads();
    NewComment.showCommentThread(tabChangeEvent?.changed[0]?.input.uri || undefined);
    codelensProvider.docChanged();
  });

  vscode.window.onDidChangeActiveTextEditor((event) => {
    if (!event) return;
    if (event.document.uri.scheme === 'file' && currentActiveFile?.path !== event?.document.uri.path && !event.document.uri.path.includes('commentinput-1')) {
      currentActiveFile = event?.document.uri;
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
    NewComment.disposeAllCommentThreads();
    NewComment.showCommentThread();
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
    NewComment.disposeAllCommentThreads();
    NewComment.showCommentThread();
  }
  )
  );

  context.subscriptions.push(vscode.commands.registerCommand("mywiki.cancelsaveComment", (comment: NewComment) => {
    if (!comment.parent) {
      return;
    }
    comment.parent.dispose();
    NewComment.disposeAllCommentThreads();
    NewComment.showCommentThread();
  }));

  context.subscriptions.push(vscode.commands.registerCommand("mywiki.saveComment", (comment: NewComment) => {
    comment.mode = vscode.CommentMode.Preview;
    if (comment.contextValue === "snippet") {
      writeToFile(comment);
    } else {
      editComment(comment);
    }
    NewComment.disposeAllCommentThreads();
    NewComment.showCommentThread();
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
}

