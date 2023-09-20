"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
let commentListPanel;
function showCommentListPanel(comments) {
    if (commentListPanel) {
        commentListPanel.reveal();
    }
    else {
        commentListPanel = vscode.window.createWebviewPanel('commentList', 'fileName - comments', vscode.ViewColumn.Two, {
            enableScripts: true,
        });
        commentListPanel.webview.html = getWebViewContent(comments);
        commentListPanel.onDidDispose(() => {
            commentListPanel = undefined;
        });
    }
}
exports.default = showCommentListPanel;
function getWebViewContent(comments) {
    let innerDivs = '';
    const keepButton = '<button class="btn" style="color:green;"><i class="fa fa-check"></i></button>';
    const deleteButton = '<button class="btn" style="color:red;"><i class="fa fa-close"></i></button>';
    comments.forEach(comment => {
        innerDivs += `<div class="comment">
			${comment}
			<div>
				${keepButton}
				${deleteButton}
			</div>
			
		</div>`;
    });
    return `
        <!DOCTYPE html>
        <html>
		<head>
			<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
			<style>
				.comment {
					display: flex;
					flex-direction: row;
					justify-content: space-between;
					background-color:black;
					color: white;
					padding:20px;
				}
				.btn {
				  background-color: transparent;
				  border: none;
				  font-size: 16px;
				  cursor: pointer;
				}

				/* Darker background on mouse-over */
				.btn:hover {
				  background-color: transparent;
				  color: lightgrey;
				}
			</style>
		</head>
        <body>
            <h4>This file was edited after the comments were saved, please update the following comments accordingly:</h4>
		<div id="containerDiv">
			${innerDivs}
		</div>
        </body>
        </html>
    `;
}
//# sourceMappingURL=webViewPanel.js.map