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
export let commentCache: Map<string, any> = new Map();
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

export async function activate(context: vscode.ExtensionContext) {
  commentCache = await readAllComments();
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
    writeToCache(newComment);
    writeToFile(newComment);
    thread.comments = [...thread.comments, newComment];
    disposeAllCommentThreads();
    showCommentThread();
    codelensProvider.docChanged();
    thread.dispose();
  }
  )
  );

  context.subscriptions.push(vscode.commands.registerCommand("mywiki.retrieveComments", (reply: vscode.CommentReply) => {
    //
    if (vscode.workspace) {
      commentCache.forEach(async (value, key) => {
        await fs.promises.mkdir(`${path.dirname(key)}`, { recursive: true });
        fs.promises.writeFile(`${key}`, JSON.stringify(value, null, 4));
      });
    }
  }));

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
    const content = commentCache.get(config.commentJSONPath);
    for (const key in content) {
      if (content[key] === comment.body) {
        delete content[key];
        fs.promises.writeFile(
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
    comment.parent.dispose();
    disposeAllCommentThreads();
    showCommentThread();
  }));

  context.subscriptions.push(vscode.commands.registerCommand("mywiki.saveComment", (comment: NewComment) => {
    comment.mode = vscode.CommentMode.Preview;
    if (comment.contextValue === "snippet") {
      writeToCache(comment);
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

  async function writeToFile(newComment: NewComment) {
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
      const fileContent = await fs.promises.readFile(folderPath, "utf8");
      existingData = JSON.parse(fileContent);
    }

    const updatedData = { ...existingData, ...commentObj };
    const jsonContent = JSON.stringify(updatedData, null, 2);
    try {
      await fs.promises.mkdir(p1, { recursive: true });
    } catch (e) {
      console.log(e);
    }
    fs.promises.writeFile(folderPath, jsonContent);
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
        const comments = commentCache.get(jsonPath) || {};
        for (const key in comments) {
          const value = comments[key];
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

  function writeToCache(newComment: NewComment) {
    const lineNo = newComment.parent
      ? newComment.parent.range.start.line + 1
      : newComment.line;
    const lineText = config.document?.lineAt(lineNo - 1).text || '';
    const commentObj = createCommentObject(lineNo + "-" + btoa(lineText), newComment.body.toString());
    const folderPath = config.commentJSONPath;
    const separatingIndex = folderPath.lastIndexOf("/");
    const p1 = folderPath.slice(0, separatingIndex);
    const existingData: unknown = commentCache.get(folderPath);
    const updatedData: unknown = existingData ? { ...existingData, ...commentObj } : commentObj;
    commentCache.set(folderPath, updatedData);
  }

  async function readAllComments(): Promise<Map<string, unknown>> {
    const vCommentsPath = `${(<any>vscode.workspace).workspaceFolders[0].uri.fsPath}/.docs`;
    if (vscode.workspace != undefined && fs.existsSync(vCommentsPath)) {
      const files = await getFiles(vCommentsPath);
      return files;
    }
    return new Map();
  }

  async function getFiles(dir: string, files: Map<string, unknown> = new Map()) {
    const fileList = await fs.promises.readdir(dir);
    for (const file of fileList) {
      const name: string = <string>`${dir}/${file}`;
      const document = await fs.promises.stat(name);
      if (document.isDirectory()) {
        await getFiles(name, files);
      } else {
        if (!name.includes('.DS_Store')) {
          const fileContent = (await fs.promises.readFile(name)).toString();
          files.set(name, JSON.parse(fileContent));
        }
      }
    }
    return files;
  }
}