import { snippets } from "./config";

export function extractFirstLine(comment: string): string {
  comment = comment.trim().replace(/^\/\*\*|\*\/$/g, "");
  const lines = comment.split("\n");
  const trimmedLines = lines.map((line) =>
    line.replace(/^\s*\*\s?/, "").trim()
  );
  const firstLine = trimmedLines.find((line) => line.length > 0);
  return firstLine ?? '';
}

export function isSnippet(comment: string) {
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

export function getSnippet(text: string | undefined): string {
  if (!text) return '';
  const classPattern = /^(\s*)class\s+\w+/;
  const functionPattern = /(?:function|const|export\s+default\s+function)\s+(\w+)\s*\([^)]*\)\s*{|const\s*(\w+)\s*=\s*\([^)]*\)\s*=>\s*{|function\s+(\w+)\s*\([^)]*\)\s*{/g;
  const variablePattern = /^(\s*)(const|let|var)\s+\w+/;

  if (classPattern.test(text)) {
    return snippets.class;
  } else if (functionPattern.test(text)) {
    return snippets.function;
  } else if (variablePattern.test(text)) {
    return snippets.variable;
  } else {
	return snippets.default;
  }
}
