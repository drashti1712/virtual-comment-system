'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
const vscode = require("vscode");
let commentId = 1;
class NoteComment {
    constructor(body, mode, author, parent, contextValue) {
        this.body = body;
        this.mode = mode;
        this.author = author;
        this.parent = parent;
        this.contextValue = contextValue;
        this.id = ++commentId;
        this.savedBody = this.body;
    }
}
function activate(context) {
    console.log('ACTIVATING....');
    //obtaining the file path
    const activeEditor = vscode.window.activeTextEditor;
    const folderName = (vscode.workspace.workspaceFolders !== undefined) ? vscode.workspace.workspaceFolders[0].name : '';
    const currentFilePath = (activeEditor && activeEditor.document && activeEditor.document.fileName) ?
        vscode.Uri.file(activeEditor.document.fileName.split(folderName)[1]).path : '';
    const currentFile = {
        currentDir: __dirname + '/../.docs' + currentFilePath
    };
    const commentController = vscode.comments.createCommentController('comment-sample', 'Comment API Sample');
    context.subscriptions.push(commentController);
    commentController.commentingRangeProvider = {
        provideCommentingRanges: (document, token) => {
            const lineCount = document.lineCount;
            //changing filePath on tab change
            const filePath = document.uri.path.split(folderName)[1];
            currentFile.currentDir = __dirname + '/../.docs' + filePath;
            return [new vscode.Range(0, 0, lineCount - 1, 0)];
        }
    };
    context.subscriptions.push(vscode.commands.registerCommand('mywiki.createNote', (reply) => {
        console.log(currentFile);
        const dir = currentFile.currentDir;
        vscode.workspace.fs.writeFile(vscode.Uri.file(dir), Buffer.from(reply.text, 'utf8'));
        replyNote(reply);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('mywiki.getComments', () => {
        vscode.window.showInformationMessage('Comments are coming!!');
        vscode.workspace.fs.readFile(vscode.Uri.file(currentFile.currentDir))
            .then(res => Buffer.from(res.buffer).toString())
            .then(res => console.log(res));
    }));
    context.subscriptions.push(vscode.commands.registerCommand('mywiki.replyNote', (reply) => {
        replyNote(reply);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('mywiki.startDraft', (reply) => {
        const thread = reply.thread;
        thread.contextValue = 'draft';
        const newComment = new NoteComment(reply.text, vscode.CommentMode.Preview, { name: 'vscode' }, thread);
        newComment.label = 'pending';
        thread.comments = [...thread.comments, newComment];
    }));
    context.subscriptions.push(vscode.commands.registerCommand('mywiki.finishDraft', (reply) => {
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
    context.subscriptions.push(vscode.commands.registerCommand('mywiki.deleteNoteComment', (comment) => {
        const thread = comment.parent;
        if (!thread) {
            return;
        }
        thread.comments = thread.comments.filter(cmt => cmt.id !== comment.id);
        if (thread.comments.length === 0) {
            thread.dispose();
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('mywiki.deleteNote', (thread) => {
        thread.dispose();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('mywiki.cancelsaveNote', (comment) => {
        if (!comment.parent) {
            return;
        }
        comment.parent.comments = comment.parent.comments.map(cmt => {
            if (cmt.id === comment.id) {
                cmt.body = cmt.savedBody;
                cmt.mode = vscode.CommentMode.Preview;
            }
            return cmt;
        });
    }));
    context.subscriptions.push(vscode.commands.registerCommand('mywiki.saveNote', (comment) => {
        if (!comment.parent) {
            return;
        }
        comment.parent.comments = comment.parent.comments.map(cmt => {
            if (cmt.id === comment.id) {
                cmt.savedBody = cmt.body;
                cmt.mode = vscode.CommentMode.Preview;
            }
            return cmt;
        });
    }));
    context.subscriptions.push(vscode.commands.registerCommand('mywiki.editNote', (comment) => {
        if (!comment.parent) {
            return;
        }
        comment.parent.comments = comment.parent.comments.map(cmt => {
            if (cmt.id === comment.id) {
                cmt.mode = vscode.CommentMode.Editing;
            }
            return cmt;
        });
    }));
    context.subscriptions.push(vscode.commands.registerCommand('mywiki.dispose', () => {
        commentController.dispose();
    }));
    function replyNote(reply) {
        const thread = reply.thread;
        const newComment = new NoteComment(reply.text, vscode.CommentMode.Preview, { name: 'vscode' }, thread, thread.comments.length ? 'canDelete' : undefined);
        if (thread.contextValue === 'draft') {
            newComment.label = 'pending';
        }
        thread.comments = [...thread.comments, newComment];
    }
}
exports.activate = activate;
//# sourceMappingURL=extension.js.map