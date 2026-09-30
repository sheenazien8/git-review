import { GitCommit, RefreshCw } from "lucide-react"
import type { BufferEntry } from "@/features/buffer/buffer"
import { isMarkdownFile } from "@/features/files/file-types"
import { CodeView } from "./code-view"
import { DiffView } from "./diff-view"
import { EditView } from "./edit-view"
import { MarkdownView } from "./markdown-view"

function Spinner() {
  return (
    <div className="flex items-center justify-center h-32">
      <RefreshCw size={20} className="animate-spin text-muted-foreground" />
    </div>
  )
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
      <GitCommit size={24} />
      <p className="text-sm mt-2">{text}</p>
    </div>
  )
}

// Picks the right view for the active tab: editor, rendered Markdown, raw
// code, or diff.
export function FileViewer({ entry, fullPath, onEditChange, onMatchIndexClamp }: {
  entry: BufferEntry | null
  fullPath: string
  onEditChange: (content: string) => void
  onMatchIndexClamp: (index: number) => void
}) {
  const find = entry?.findOpen
    ? { findQuery: entry.findQuery, findCaseSensitive: entry.findCaseSensitive, findMatchIndex: entry.findMatchIndex }
    : { findCaseSensitive: entry?.findCaseSensitive }

  if (entry?.editMode) {
    return (
      <EditView
        content={entry.editContent}
        file={entry.file}
        onChange={onEditChange}
        onMatchIndexClamp={onMatchIndexClamp}
        {...find}
      />
    )
  }

  let body
  if (!entry) {
    body = <Placeholder text="Select a file to view diff" />
  } else if (entry.diffLoading && !entry.fromAll) {
    body = <Spinner />
  } else if (entry.mdRender && isMarkdownFile(entry.file)) {
    body = <MarkdownView content={entry.md} fullPath={fullPath} {...find} />
  } else if (entry.fromAll || entry.viewMode === "raw") {
    body = entry.rawError ? (
      <div className="p-4 text-sm text-destructive whitespace-pre-wrap break-words">{entry.rawError}</div>
    ) : entry.raw ? (
      <CodeView content={entry.raw} file={entry.file} fullPath={fullPath} {...find} />
    ) : (
      <Spinner />
    )
  } else if (entry.diff) {
    body = <DiffView raw={entry.diff} view={entry.viewMode === "split" ? "split" : "unified"} fullPath={fullPath} {...find} />
  } else {
    body = <Placeholder text="No changes for this file" />
  }

  return <div className="diff-scroll h-full overflow-auto">{body}</div>
}
