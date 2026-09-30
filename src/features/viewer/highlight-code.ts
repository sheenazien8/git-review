import hljs from "highlight.js/lib/common"
import "highlight.js/styles/github.css"
import { langForFile } from "@/features/files/file-types"
import { escapeHtml } from "@/features/find/find"

// Syntax-highlights file content to HTML, auto-detecting unknown languages.
export function highlightCode(content: string, file: string): string {
  const lang = langForFile(file)
  try {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(content, { language: lang, ignoreIllegals: true }).value
    }
    return hljs.highlightAuto(content).value
  } catch {
    return escapeHtml(content)
  }
}
