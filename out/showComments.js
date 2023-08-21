'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.showComments = void 0;
const vscode = require("vscode");
const fs = require("fs");
const activeEditor = vscode.window.activeTextEditor;
const folderName = (vscode.workspace.workspaceFolders !== undefined) ? vscode.workspace.workspaceFolders[0].name : '';
const newVar = activeEditor ? activeEditor.document.fileName : '';
const newStr = newVar.split(folderName).join(folderName + '\\.docs');
const config = {
    commentJSONPath: newStr + '.json',
    currentFilePath: activeEditor ? activeEditor.document.fileName : ''
};
function showComments() {
    const content = (fs.existsSync(config.commentJSONPath)) ? JSON.parse(fs.readFileSync(config.commentJSONPath, 'utf-8')) : [];
    return vscode.languages.registerCodeLensProvider({ scheme: 'file' }, {
        provideCodeLenses(document, token) {
            const codeLenses = [];
            const existingCodeLensRanges = [];
            // Iterate over existing CodeLenses and store their ranges
            for (const codeLens of codeLenses) {
                existingCodeLensRanges.push(codeLens.range);
            }
            for (const entry of content) {
                const range = new vscode.Range(entry.lineNumber - 1, 0, entry.lineNumber - 1, 0);
                if (!existingCodeLensRanges.some(existingRange => existingRange.contains(range))) {
                    const command = {
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
                }
            }
            return codeLenses;
        }
    });
}
exports.showComments = showComments;
//# sourceMappingURL=showComments.js.map