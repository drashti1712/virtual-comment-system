export function getWebViewContent(comments: { lineNumber: number; text: string; }[]) {
	let innerDivs = '';
	const keepButton = `<button onclick="keepComment(this)" class="btn keep-btn" style="color:#9DFFCA;"><i class="fa fa-check"></i></button>`;
	const editButton = `<button onclick="editComment(this)" class="btn edit-btn" style="color:#81B6F6;"><i class="fa fa-pencil"></i></button>`;
	const deleteButton = '<button onclick="deleteComment(this)" class="btn delete-btn" style="color:#FF9DB1;"><i class="fa fa-close"></i></button>';
	comments.forEach(comment => {
		innerDivs+=`<div class="comment">
			<div>
				Line
				<span>${comment.lineNumber}</span>
				-
				<span id="text">${comment.text}</span>
			</div>
			<div>
				${keepButton}
				${editButton}
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
		<script>
		const vscode = acquireVsCodeApi();
		function keepComment(buttonEl){
			const commentText = buttonEl.parentElement.previousElementSibling.lastElementChild.innerHTML;
			const commentLineNumber = buttonEl.parentElement.previousElementSibling.firstElementChild.innerText;
			vscode.postMessage({command: "keep", text: commentText, lineNumber: commentLineNumber });
		}
		function deleteComment(buttonEl){
			const commentText = buttonEl.parentElement.previousElementSibling.lastElementChild.innerHTML;
			const commentLineNumber = buttonEl.parentElement.previousElementSibling.firstElementChild.innerText; 
			vscode.postMessage({command: "delete", text: commentText, lineNumber: commentLineNumber });
		}
		function editComment(buttonEl){
			const commentText = buttonEl.parentElement.previousElementSibling.lastElementChild.innerHTML;
			const commentLineNumber = buttonEl.parentElement.previousElementSibling.firstElementChild.innerText; 
			vscode.postMessage({command: "edit", text: commentText, lineNumber: commentLineNumber });
		}
		</script>
        </body>
        </html>
    `;
}