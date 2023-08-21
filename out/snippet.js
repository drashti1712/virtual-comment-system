"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSnippet = exports.isSnippet = exports.extractFirstLine = void 0;
const config_1 = require("./config");
function extractFirstLine(comment) {
    comment = comment.trim().replace(/^\/\*\*|\*\/$/g, "");
    const lines = comment.split("\n");
    const trimmedLines = lines.map((line) => line.replace(/^\s*\*\s?/, "").trim());
    const firstLine = trimmedLines.find((line) => line.length > 0);
    return firstLine ?? null;
}
exports.extractFirstLine = extractFirstLine;
function isSnippet(comment) {
    comment = comment.trim();
    if (!comment.startsWith("/**")) {
        return false;
    }
    if (!comment.endsWith("*/")) {
        return false;
    }
    if (comment.indexOf("@") === -1) {
        return false;
    }
    return true;
}
exports.isSnippet = isSnippet;
function getSnippet(text) {
    if (!text)
        return '';
    const classPattern = /^(\s*)class\s+\w+/;
    const functionPattern = /(?:function|const|export\s+default\s+function)\s+(\w+)\s*\([^)]*\)\s*{|const\s*(\w+)\s*=\s*\([^)]*\)\s*=>\s*{|function\s+(\w+)\s*\([^)]*\)\s*{/g;
    const variablePattern = /^(\s*)(const|let|var)\s+\w+/;
    if (classPattern.test(text)) {
        return config_1.snippets.class;
    }
    else if (functionPattern.test(text)) {
        return config_1.snippets.function;
    }
    else if (variablePattern.test(text)) {
        return config_1.snippets.variable;
    }
    else {
        return config_1.snippets.default;
    }
}
exports.getSnippet = getSnippet;
//# sourceMappingURL=snippet.js.map