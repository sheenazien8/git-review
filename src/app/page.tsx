"use client"

import { useState, useCallback, useEffect, useRef, useSyncExternalStore } from "react"
import {
  GitBranch,
  GitCommit,
  FilePen,
  FilePlus,
  FileMinus,
  File,
  ChevronRight,
  RefreshCw,
  Folder,
  FolderUp,
  Split,
  AlignJustify,
  FileCode,
  Plus,
  Minus,
  Sun,
  Moon,
  Eye,
  Maximize,
  Minimize,
  Check,
  Upload,
} from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import projects from "../../projects.json"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"
import hljs from "highlight.js/lib/common"
import "highlight.js/styles/github.css"

// The .dark class on <html> is the source of truth for the theme. It is
// applied pre-hydration by the inline script in layout.tsx (localStorage,
// falling back to prefers-color-scheme). Reading it via useSyncExternalStore
// keeps state in sync with the DOM without a post-mount setState and without
// hydration mismatches.
function subscribeToTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
  return () => observer.disconnect()
}

function isThemeDark() {
  return document.documentElement.classList.contains("dark")
}

function isThemeDarkServer() {
  return false
}
interface GitFile {
  path: string
  status: string
  staged: boolean
  oldPath?: string
}

interface DiffLine {
  type: "add" | "remove" | "context"
  content: string
  oldLineNo?: number
  newLineNo?: number
}

interface DiffHunk {
  header: string
  lines: DiffLine[]
}

function parseDiff(raw: string): DiffHunk[] {
  const hunks: DiffHunk[] = []
  const lines = raw.split("\n")
  let currentHunk: DiffHunk | null = null
  let oldLine = 0
  let newLine = 0

  for (const line of lines) {
    if (line.startsWith("@@")) {
      if (currentHunk) hunks.push(currentHunk)
      const m = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
      oldLine = m ? parseInt(m[1]) : 0
      newLine = m ? parseInt(m[2]) : 0
      currentHunk = { header: line, lines: [] }
    } else if (currentHunk) {
      if (line.startsWith("+")) {
        currentHunk.lines.push({ type: "add", content: line, newLineNo: newLine++ })
      } else if (line.startsWith("-")) {
        currentHunk.lines.push({ type: "remove", content: line, oldLineNo: oldLine++ })
      } else if (!line.startsWith("\\")) {
        currentHunk.lines.push({ type: "context", content: line, oldLineNo: oldLine++, newLineNo: newLine++ })
      }
    }
  }
  if (currentHunk) hunks.push(currentHunk)
  return hunks
}

// Copies text to the clipboard, falling back to a hidden textarea for
// contexts where the async Clipboard API is unavailable (non-secure origin).
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement("textarea")
    ta.value = text
    ta.style.position = "fixed"
    ta.style.opacity = "0"
    document.body.appendChild(ta)
    ta.select()
    try {
      document.execCommand("copy")
    } catch {
      // nothing else we can do
    }
    document.body.removeChild(ta)
  }
}

// Tracks which line was just copied ("view-row" key) so the UI can flash a
// checkmark on it for a moment. Shared by every view type.
function useCopied() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const markCopied = useCallback((key: string) => {
    setCopiedKey(key)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopiedKey(null), 1500)
  }, [])
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])
  return { copiedKey, markCopied }
}

// Tooltip text describing what the next click will copy.
function copyTitleFor(fullPath: string, anchor: number | null, lineNo: number) {
  if (!fullPath) return undefined
  if (anchor === null) return `Copy ${fullPath}:${lineNo} (click twice for a range)`
  if (anchor === lineNo) return `Copy ${fullPath}:${lineNo}`
  return `Copy ${fullPath}:${Math.min(anchor, lineNo)}-${Math.max(anchor, lineNo)}`
}

// Shared "click twice to copy a path:line range" behavior, used by every
// view type. The first click anchors a line; a second click on another line
// copies "<fullPath>:<min>-<max>" while a second click on the anchored line
// copies just "<fullPath>:<line>". Escape cancels a pending anchor, and
// hovering after the first click previews the highlighted range.
function useCopyRange(fullPath: string) {
  const { copiedKey, markCopied } = useCopied()
  // The anchor carries the path it was set on, so switching files (or repos)
  // simply invalidates a stale anchor during render — no effect needed.
  const [anchorState, setAnchorState] = useState<{ path: string; line: number } | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  const anchor = anchorState && anchorState.path === fullPath ? anchorState.line : null

  useEffect(() => {
    if (anchor === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAnchorState(null)
        setHover(null)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [anchor])

  const click = useCallback((lineNo: number | undefined, key: string) => {
    // Clicks that are part of a text selection are ignored so copy behaves
    // like an editor gutter action.
    if (window.getSelection()?.toString()) return
    if (!fullPath || lineNo == null) return
    if (anchor === null) {
      setAnchorState({ path: fullPath, line: lineNo })
      return
    }
    if (anchor !== lineNo) {
      copyText(`${fullPath}:${Math.min(anchor, lineNo)}-${Math.max(anchor, lineNo)}`)
    } else {
      copyText(`${fullPath}:${lineNo}`)
    }
    markCopied(key)
    setAnchorState(null)
  }, [fullPath, anchor, markCopied])

  const rangePreview =
    anchor != null && hover != null && hover !== anchor
      ? ([Math.min(anchor, hover), Math.max(anchor, hover)] as const)
      : null

  return { copiedKey, anchor, click, rangePreview, setHover }
}

function statusIcon(s: string) {
  switch (s) {
    case "modified": return <FilePen size={14} />
    case "added": return <FilePlus size={14} />
    case "deleted": return <FileMinus size={14} />
    case "untracked": return <Plus size={14} />
    case "renamed": return <ChevronRight size={14} />
    default: return <File size={14} />
  }
}

function statusBadgeColor(s: string) {
  switch (s) {
    case "modified": return "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700"
    case "added": return "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700"
    case "deleted": return "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700"
    case "untracked": return "bg-muted text-muted-foreground border-border"
    default: return "bg-muted text-muted-foreground border-border"
  }
}

function statusLabel(s: string) {
  switch (s) {
    case "modified": return "Modified"
    case "added": return "Added"
    case "deleted": return "Deleted"
    case "untracked": return "Untracked"
    case "renamed": return "Renamed"
    default: return "Unknown"
  }
}

function DiffView({ raw, view, fullPath }: { raw: string; view: "unified" | "split"; fullPath: string }) {
  const hunks = parseDiff(raw)
  const { copiedKey, anchor, click, rangePreview, setHover } = useCopyRange(fullPath)

  if (hunks.length === 0) return <div className="p-4 text-center text-sm text-muted-foreground">No diff output</div>

  const addBg = "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300"
  const removeBg = "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300"
  const ctxBg = "text-neutral-700 dark:text-neutral-300"
  const hunkBg = "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"

  // While a line is anchored, hovering another line previews the range that
  // the second click would copy.
  const inRange = (lineNo: number | undefined) =>
    rangePreview != null && lineNo != null && lineNo >= rangePreview[0] && lineNo <= rangePreview[1]

  if (view === "split") {
    return (
      <div className="font-mono text-xs overflow-x-auto" onMouseLeave={() => setHover(null)}>
        {hunks.map((hunk, hi) => (
          <div key={hi}>
            <div className={`${hunkBg} px-2 py-1 sticky top-0 z-10`}>{hunk.header}</div>
            {hunk.lines.map((line, li) => {
              const key = `s-${hi}-${li}`
              const copied = copiedKey === key
              // The line number this row copies: new-file numbering for
              // adds/context, old-file numbering for removes.
              const rowNo = line.type === "remove" ? line.oldLineNo : line.newLineNo
              const shown = line.type === "add" ? undefined : line.oldLineNo
              const isAnchor = anchor === rowNo
              const numCls = isAnchor
                ? "bg-primary! text-primary-foreground!"
                : inRange(rowNo)
                  ? "bg-primary/15!"
                  : ""
              const contentBg = line.type === "add" ? addBg : line.type === "remove" ? removeBg : ctxBg
              return (
                <div
                  key={li}
                  title={copyTitleFor(fullPath, anchor, rowNo ?? 0)}
                  onClick={() => click(rowNo, key)}
                  onMouseEnter={() => setHover(rowNo ?? null)}
                  className="flex w-max min-w-full cursor-pointer"
                >
                  <span className={`w-10 shrink-0 bg-muted text-muted-foreground text-right pr-1 select-none text-xs border-r border-border ${numCls}`}>
                    {copied ? <Check size={12} className="inline-block align-middle" /> : isAnchor ? rowNo : shown ?? ""}
                  </span>
                  <span className={`flex-1 ${contentBg} pl-1 whitespace-pre`}>{line.content}</span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="font-mono text-xs overflow-x-auto" onMouseLeave={() => setHover(null)}>
      {hunks.map((hunk, hi) => (
        <div key={hi}>
          <div className={`${hunkBg} px-4 py-1 sticky top-0 z-10`}>{hunk.header}</div>
          {hunk.lines.map((line, li) => {
            const bg = line.type === "add" ? addBg : line.type === "remove" ? removeBg : ""
            const text = line.type === "add" ? "" : line.type === "remove" ? "" : ctxBg
            const prefix = line.type === "add" ? "+" : line.type === "remove" ? "-" : " "
            const lineNo = line.type === "remove" ? line.oldLineNo : line.newLineNo
            const key = `u-${hi}-${li}`
            const isAnchor = anchor === lineNo
            const numCls = isAnchor
              ? "bg-primary! text-primary-foreground!"
              : inRange(lineNo)
                ? "bg-primary/15!"
                : "text-muted-foreground"
            return (
              <div
                key={li}
                title={copyTitleFor(fullPath, anchor, lineNo ?? 0)}
                onClick={() => click(lineNo, key)}
                onMouseEnter={() => setHover(lineNo ?? null)}
                className={`flex w-max min-w-full cursor-pointer ${bg} ${text}`}
              >
                <span className={`w-12 shrink-0 text-right pr-2 select-none border-r border-border ${numCls}`}>
                  {copiedKey === key ? <Check size={12} className="inline-block align-middle" /> : lineNo ?? ""}
                </span>
                <span className="w-5 shrink-0 text-center select-none">{prefix}</span>
                <span className="flex-1 pl-2 whitespace-pre">{line.content}</span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

const isMarkdownFile = (file: string) => /\.(md|markdown|mdx)$/i.test(file)

const extToLang: Record<string, string> = {
  ts: "typescript", tsx: "typescript", mts: "typescript",
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  json: "json", md: "markdown", mdx: "markdown",
  py: "python", go: "go", rs: "rust", rb: "ruby",
  css: "css", scss: "scss", html: "xml", xml: "xml", svg: "xml",
  sh: "bash", bash: "bash", zsh: "bash",
  yml: "yaml", yaml: "yaml", toml: "ini", sql: "sql",
  java: "java", kt: "kotlin", swift: "swift",
  c: "c", h: "c", cpp: "cpp", hpp: "cpp", cc: "cpp",
  cs: "csharp", php: "php", dart: "dart", lua: "lua",
  dockerfile: "dockerfile", makefile: "makefile",
}

function CodeView({ content, file, fullPath }: { content: string; file: string; fullPath: string }) {
  const ext = file.split(".").pop()?.toLowerCase() ?? ""
  const lang = extToLang[ext]
  let html: string
  try {
    if (lang && hljs.getLanguage(lang)) {
      html = hljs.highlight(content, { language: lang, ignoreIllegals: true }).value
    } else {
      html = hljs.highlightAuto(content).value
    }
  } catch {
    html = content
  }
  const lines = content.split("\n")
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop()
  const { copiedKey, anchor, click, rangePreview, setHover } = useCopyRange(fullPath)
  return (
    <div className="flex text-xs font-mono" onMouseLeave={() => setHover(null)}>
      {/* Clickable gutter: click a number to anchor it, click a second number
          to copy "<repo>/<file>:<start>-<end>" (same number twice copies a single
          line). The gutter shares the code's line-height (leading-5 / h-5) and
          stays put while the code column scrolls horizontally. */}
      <div className="shrink-0 select-none border-r border-border bg-muted/30 py-4 leading-5 text-muted-foreground">
        {lines.map((_, i) => {
          const n = i + 1
          const key = `r-${n}`
          const copied = copiedKey === key
          const isAnchor = anchor === n
          const inPreview = rangePreview != null && n >= rangePreview[0] && n <= rangePreview[1]
          return (
            <div
              key={n}
              title={copyTitleFor(fullPath, anchor, n)}
              onClick={() => click(n, key)}
              onMouseEnter={() => setHover(n)}
              className={`h-5 min-w-10 pl-3 pr-2 text-right cursor-pointer ${copied ? "text-green-600 dark:text-green-400" : ""} ${isAnchor ? "bg-primary! text-primary-foreground!" : inPreview ? "bg-primary/15!" : "hover:bg-accent"}`}
            >
              {copied ? <Check size={12} className="inline-block align-middle" /> : n}
            </div>
          )
        })}
      </div>
      <pre className="flex-1 overflow-x-auto p-4 leading-5">
        {/* p-0! neutralizes the stylesheet's `pre code.hljs { padding: 1em }`
            so the code text aligns with the gutter. */}
        <code className="hljs p-0!" dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  )
}

function MarkdownView({ content }: { content: string }) {
  return (
    <div className="p-4 prose prose-sm dark:prose-invert max-w-none prose-pre:p-0 prose-pre:bg-transparent prose-code:before:content-none prose-code:after:content-none">
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
      >
        {content}
      </Markdown>
    </div>
  )
}

export default function GitReviewPage() {
  const isDark = useSyncExternalStore(subscribeToTheme, isThemeDark, isThemeDarkServer)
  // Seed with the first project so the client always knows the active repo
  // (the server used to silently fall back to a default when repo=""),
  // keeping the copy path:line action's "fullpath" honest from first load.
  const [repoPath, setRepoPath] = useState(projects.projects[0]?.dir ?? "")
  const [loading, setLoading] = useState(false)
  const [files, setFiles] = useState<GitFile[]>([])
  const [branch, setBranch] = useState("")
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [selectedStaged, setSelectedStaged] = useState(false)
  const [activeTab, setActiveTab] = useState("changes")
  const [fileDiff, setFileDiff] = useState("")
  const [diffLoading, setDiffLoading] = useState(false)
  const [viewMode, setViewMode] = useState<"unified" | "split" | "raw">("split")
  const [error, setError] = useState("")
  const [mdRender, setMdRender] = useState(false)
  const [mdContent, setMdContent] = useState("")
  const [rawContent, setRawContent] = useState("")
  const [rawFile, setRawFile] = useState("")
  const [rawError, setRawError] = useState("")
  const [allFiles, setAllFiles] = useState<{ path: string; status: string; type?: string }[]>([])
  const [allFilesDir, setAllFilesDir] = useState("")
  const [selectedFromAll, setSelectedFromAll] = useState(false)
  const [commitMsg, setCommitMsg] = useState("")
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [actionResult, setActionResult] = useState<{ ok: boolean; message: string } | null>(null)
  const diffCardRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  const toggleFullscreen = () => {
    const el = diffCardRef.current
    if (!el) return
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    } else {
      el.requestFullscreen().catch(() => {})
    }
  }

  const toggleTheme = useCallback(() => {
    const next = !isThemeDark()
    document.documentElement.classList.toggle("dark", next)
    localStorage.setItem("git-review-dark", String(next))
  }, [])

  const loadAllFiles = useCallback(async (repo?: string) => {
    const target = repo ?? repoPath
    try {
      const res = await fetch(`/api/git/all-files?repo=${encodeURIComponent(target)}`)
      const data = await res.json()
      if (!data.error) {
        setAllFiles(data.files || [])
        setAllFilesDir("")
      }
    } catch {
      // silently fail — this is auxiliary
    }
  }, [repoPath])

  const loadStatus = useCallback(async (repo?: string): Promise<GitFile[] | null> => {
    const target = repo ?? repoPath
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/git/status?repo=${encodeURIComponent(target)}`)
      const data = await res.json()
      if (data.error) { setError(data.error); return null }
      setFiles(data.files || [])
      setBranch(data.branch || "")
      await loadAllFiles(target)
      return data.files || []
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load git status")
      return null
    } finally {
      setLoading(false)
    }
  }, [repoPath, loadAllFiles])

  const loadRaw = useCallback(async (file: string) => {
    setRawFile(file)
    setRawError("")
    try {
      const res = await fetch(`/api/git/content?repo=${encodeURIComponent(repoPath)}&file=${encodeURIComponent(file)}`)
      const data = await res.json()
      if (data.error) {
        setRawError(data.error)
        setRawContent("")
      } else {
        setRawContent(data.content ?? "")
      }
    } catch (e) {
      setRawError(e instanceof Error ? e.message : "Failed to read file")
      setRawContent("")
    }
  }, [repoPath])

  const loadDiff = useCallback(async (file: string, staged: boolean) => {
    setSelectedFile(file)
    setSelectedStaged(staged)
    setSelectedFromAll(false)
    setMdRender(false)
    setMdContent("")
    setRawContent("")
    setRawFile("")
    setRawError("")
    setDiffLoading(true)
    // If we're already in raw mode, fetch the new file's content right away
    // instead of leaving a spinner until the Raw button is clicked again.
    if (viewMode === "raw") loadRaw(file)
    try {
      const res = await fetch(`/api/git/diff?repo=${encodeURIComponent(repoPath)}&file=${encodeURIComponent(file)}&staged=${staged ? 1 : 0}`)
      const data = await res.json()
      setFileDiff(data.diff || "")
    } catch {
      setFileDiff("")
    } finally {
      setDiffLoading(false)
    }
  }, [repoPath, viewMode, loadRaw])

  const runAction = useCallback(async (
    action: "add" | "addAll" | "unstage" | "unstageAll" | "commit" | "push",
    payload?: { files?: string[]; message?: string }
  ) => {
    setBusyAction(action)
    setActionResult(null)
    try {
      const res = await fetch("/api/git/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, repo: repoPath, ...payload }),
      })
      const data = await res.json()
      if (data.error) {
        setActionResult({ ok: false, message: data.error })
      } else {
        setActionResult({ ok: true, message: data.message || "Done" })
        if (action === "commit") setCommitMsg("")
        const fresh = await loadStatus()
        // Staging/unstaging the selected file can flip which side of it we are
        // looking at — sync the diff header's stage/unstage button and reload
        // the matching diff so the view never goes stale.
        if (
          fresh &&
          selectedFile &&
          (action === "addAll" || action === "unstageAll" || payload?.files?.includes(selectedFile))
        ) {
          const nowStaged = fresh.some(f => f.path === selectedFile && f.staged)
          setSelectedStaged(nowStaged)
          const diffRes = await fetch(`/api/git/diff?repo=${encodeURIComponent(repoPath)}&file=${encodeURIComponent(selectedFile)}&staged=${nowStaged ? 1 : 0}`)
          const diffData = await diffRes.json()
          setFileDiff(diffData.diff || "")
        }
      }
    } catch (e) {
      setActionResult({ ok: false, message: e instanceof Error ? e.message : "Action failed" })
    } finally {
      setBusyAction(null)
    }
  }, [repoPath, loadStatus, selectedFile])

  const loadMarkdown = useCallback(async (file: string) => {
    try {
      const res = await fetch(`/api/git/content?repo=${encodeURIComponent(repoPath)}&file=${encodeURIComponent(file)}`)
      const data = await res.json()
      setMdContent(data.content ?? "")
    } catch {
      setMdContent("")
    }
  }, [repoPath])

  const stagedFiles = files.filter(f => f.staged)
  const changedFiles = files.filter(f => !f.staged && f.status !== "untracked")
  const untrackedFiles = files.filter(f => f.status === "untracked")
  // Absolute path of the currently selected file — used by the copy
  // path:line action in every view type.
  const selectedFullPath = selectedFile ? (repoPath ? `${repoPath}/${selectedFile}` : selectedFile) : ""

  // Entries of the currently browsed directory ("" = repo root).
  const visibleAllFiles = allFiles.filter(
    (e) =>
      (e.path.includes("/") ? e.path.slice(0, e.path.lastIndexOf("/")) : "") ===
      allFilesDir
  )

  const renderAllFileList = (entries: { path: string; status: string; type?: string }[], emptyText: string) => {
    if (entries.length === 0 && allFilesDir === "") {
      return (
        <div className="h-72 flex items-center justify-center text-xs text-muted-foreground">
          {emptyText}
        </div>
      )
    }
    return (
      <ScrollArea className="h-72">
        <div className="p-1">
          {allFilesDir !== "" && (
            <div
              onClick={() =>
                setAllFilesDir(
                  allFilesDir.includes("/")
                    ? allFilesDir.slice(0, allFilesDir.lastIndexOf("/"))
                    : ""
                )
              }
              className="group flex items-center gap-1 px-2 py-1.5 rounded-md text-xs transition-colors cursor-pointer text-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <span className="shrink-0 text-muted-foreground">
                <FolderUp size={14} />
              </span>
              <span className="truncate flex-1">..</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded border shrink-0 bg-muted text-muted-foreground border-border">
                {allFilesDir}
              </span>
            </div>
          )}
          {entries.map((entry) => {
            const isDir = entry.type === "dir"
            return (
            <div
              key={entry.path}
              onClick={() => {
                if (isDir) {
                  setAllFilesDir(entry.path)
                  return
                }
                setSelectedFile(entry.path)
                setSelectedStaged(false)
                setSelectedFromAll(true)
                setMdRender(false)
                setMdContent("")
                setFileDiff("")
                setDiffLoading(false)
                loadRaw(entry.path)
              }}
              className={`group flex items-center gap-1 px-2 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${selectedFile === entry.path && selectedFromAll && !isDir ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent hover:text-accent-foreground"}`}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 flex-1 min-w-0 text-left">
                    <span className={`shrink-0 ${selectedFile === entry.path && selectedFromAll && !isDir ? "text-primary-foreground" : isDir ? "text-muted-foreground/70" : "text-muted-foreground"}`}>
                      {isDir ? <Folder size={14} /> : entry.status === "untracked" ? <Plus size={14} /> : <File size={14} />}
                    </span>
                    <span className={`truncate flex-1 ${isDir ? "font-medium" : ""}`}>{entry.path.split("/").pop()}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${selectedFile === entry.path && selectedFromAll && !isDir ? "bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30" : "bg-muted text-muted-foreground border-border"}`}>
                      {entry.status}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="text-xs">{entry.path}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            )
          })}
        </div>
      </ScrollArea>
    )
  }

  // Shared row renderer for every file-list tab. `staged` marks which
  // working-tree group the list belongs to, so selection highlighting only
  // applies while the diff viewer is showing that file from that group.
  const renderFileList = (entries: GitFile[], emptyText: string) => {
    if (entries.length === 0) {
      return (
        <div className="h-72 flex items-center justify-center text-xs text-muted-foreground">
          {emptyText}
        </div>
      )
    }
    return (
      <ScrollArea className="h-72">
        <div className="p-1">
          {entries.map((entry) => (
            <div
              key={`${entry.staged ? "s" : "w"}-${entry.path}`}
              onClick={() => loadDiff(entry.path, entry.staged)}
              className={`group flex items-center gap-1 px-2 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${selectedFile === entry.path && selectedStaged === entry.staged ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent hover:text-accent-foreground"}`}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 flex-1 min-w-0 text-left">
                    <span className={`shrink-0 ${selectedFile === entry.path && selectedStaged === entry.staged ? "text-primary-foreground" : "text-muted-foreground"}`}>
                      {statusIcon(entry.status)}
                    </span>
                    <span className="truncate flex-1">{entry.path.split("/").pop()}</span>
                    {entry.status !== "untracked" && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${selectedFile === entry.path && selectedStaged === entry.staged ? "bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30" : statusBadgeColor(entry.status)}`}>
                        {statusLabel(entry.status)}
                      </span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="text-xs">{entry.path}</p>
                  {entry.oldPath && <p className="text-xs text-muted-foreground">from: {entry.oldPath}</p>}
                </TooltipContent>
              </Tooltip>
            </div>
          ))}
        </div>
      </ScrollArea>
    )
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-6xl mx-auto p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GitBranch size={20} className="text-muted-foreground" />
              <h1 className="text-lg font-semibold">Git Review</h1>
              {branch && <Badge variant="secondary" className="text-xs">{branch}</Badge>}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleTheme()}
              className="gap-2"
            >
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
              <span className="hidden sm:inline">{isDark ? "Light" : "Dark"}</span>
            </Button>
          </div>

          {/* Repo Input */}
          <Card className="px-2 py-0">

            <form
              onSubmit={e => { e.preventDefault(); loadStatus() }}
              className="flex gap-2"
            >
              <div className="relative flex-1 my-2">
                <Folder size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <select
                  value={repoPath}
                  onChange={e => {
                    setRepoPath(e.target.value)
                    setSelectedFile(null)
                    setFiles([])
                    setAllFiles([])
                    loadStatus(e.target.value)
                  }}
                  title={repoPath}
                  className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                >
                  {projects.projects.map(p => (
                    <option key={p.dir} value={p.dir}>{p.name}</option>
                  ))}
                </select>
              </div>
              <Button type="submit" disabled={loading} className="h-10 gap-1.5 my-2">
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </form>

          </Card>

          {/* Git Actions */}
          <Card className="px-3 py-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={commitMsg}
                onChange={e => setCommitMsg(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && commitMsg.trim() && !busyAction) {
                    runAction("commit", { message: commitMsg })
                  }
                }}
                placeholder="Commit message…"
                className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button
                className="h-10 gap-1.5"
                disabled={!!busyAction || !commitMsg.trim()}
                onClick={() => runAction("commit", { message: commitMsg })}
              >
                {busyAction === "commit" ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                Commit
              </Button>
              <Button
                variant="outline"
                className="h-10 gap-1.5"
                disabled={!!busyAction}
                onClick={() => runAction("push")}
              >
                {busyAction === "push" ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                Push
              </Button>
            </div>
          </Card>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* File List */}
            <div className="lg:col-span-2">
              <Card className="h-full">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col">
                  <CardHeader className="p-0">
                    <TabsList className="grid w-full grid-cols-4 h-auto rounded-none p-0 bg-muted">
                      <TabsTrigger value="all" className="gap-1.5 text-sm w-full justify-center rounded-none py-2">
                        <File size={13} />
                        All
                        <span className="text-[10px] text-muted-foreground">({visibleAllFiles.length})</span>
                      </TabsTrigger>
                      <TabsTrigger value="changes" className="gap-1.5 text-sm w-full justify-center rounded-none py-2">
                        <FilePen size={13} />
                        Changes
                        <span className="text-[10px] text-muted-foreground">({changedFiles.length})</span>
                      </TabsTrigger>
                      <TabsTrigger value="untracked" className="gap-1.5 text-sm w-full justify-center rounded-none py-2">
                        <Plus size={13} />
                        Untracked
                        <span className="text-[10px] text-muted-foreground">({untrackedFiles.length})</span>
                      </TabsTrigger>
                      <TabsTrigger value="staged" className="gap-1.5 text-sm w-full justify-center rounded-none py-2">
                        <GitCommit size={13} />
                        Staged
                        <span className="text-[10px] text-muted-foreground">({stagedFiles.length})</span>
                      </TabsTrigger>
                    </TabsList>
                  </CardHeader>
                  <Separator />
                  <CardContent className="p-0">
                    <TabsContent value="all" className="mt-0">
                      {renderAllFileList(visibleAllFiles, "No files")}
                    </TabsContent>
                    <TabsContent value="changes" className="mt-0">
                      {renderFileList(changedFiles, "No modified files")}
                    </TabsContent>
                    <TabsContent value="untracked" className="mt-0">
                      {renderFileList(untrackedFiles, "No untracked files")}
                    </TabsContent>
                    <TabsContent value="staged" className="mt-0">
                      {renderFileList(stagedFiles, "Nothing staged")}
                    </TabsContent>
                  </CardContent>
                </Tabs>
              </Card>

              {files.length === 0 && !loading && (
                <Card>
                  <CardContent className="p-6 text-center text-sm text-muted-foreground">
                    No changes. Click Refresh to load.
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Diff Viewer */}
            <div className="lg:col-span-3">
              <Card ref={diffCardRef} className="h-full diff-card">
                <CardHeader className="p-3 pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm truncate">
                      {selectedFile ? selectedFile.split("/").pop() : "Select a file"}
                    </CardTitle>
                    {selectedFile && !selectedFromAll && (
                      <div className="flex items-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={!!busyAction}
                              onClick={() => {
                                if (selectedStaged) {
                                  runAction("unstage", { files: [selectedFile] })
                                  // After unstaging, the file lands back in Changes
                                  // (or Untracked if it was never tracked before).
                                  const entry = files.find(f => f.path === selectedFile)
                                  setActiveTab(entry && (entry.status === "added" || entry.status === "untracked") ? "untracked" : "changes")
                                } else {
                                  runAction("add", { files: [selectedFile] })
                                  setActiveTab("staged")
                                }
                              }}
                            >
                              {busyAction === "add" || busyAction === "unstage" ? <RefreshCw size={13} className="animate-spin" /> : selectedStaged ? <Minus size={13} /> : <Plus size={13} />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">{selectedStaged ? "Unstage this file" : "Stage this file"}</TooltipContent>
                        </Tooltip>
                        {selectedFile && isMarkdownFile(selectedFile) && (
                          <Button
                            variant={mdRender ? "default" : "outline"}
                            size="icon"
                            className="h-7 w-7"
                            title="Render as Markdown"
                            onClick={() => {
                              if (!mdRender) loadMarkdown(selectedFile)
                              setMdRender(!mdRender)
                            }}
                          >
                            <Eye size={13} />
                          </Button>
                        )}
                        <Button
                          variant={viewMode === "raw" ? "default" : "outline"}
                          size="icon"
                          className="h-7 w-7"
                          title="View raw file (syntax highlighted)"
                          onClick={() => {
                            setViewMode("raw")
                            if (selectedFile && (rawFile !== selectedFile || rawError)) loadRaw(selectedFile)
                          }}
                        >
                          <FileCode size={13} />
                        </Button>
                        <Button
                          variant={viewMode === "unified" ? "default" : "outline"}
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setViewMode("unified")}
                        >
                          <AlignJustify size={13} />
                        </Button>
                        <Button
                          variant={viewMode === "split" ? "default" : "outline"}
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setViewMode("split")}
                        >
                          <Split size={13} />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                          onClick={toggleFullscreen}
                        >
                          {isFullscreen ? <Minimize size={13} /> : <Maximize size={13} />}
                        </Button>
                      </div>
                    )}
                    {selectedFile && selectedFromAll && (
                      <div className="flex items-center gap-1">
                        {selectedFile && isMarkdownFile(selectedFile) && (
                          <Button
                            variant={mdRender ? "default" : "outline"}
                            size="icon"
                            className="h-7 w-7"
                            title="Render as Markdown"
                            onClick={() => {
                              if (!mdRender) loadMarkdown(selectedFile)
                              setMdRender(!mdRender)
                            }}
                          >
                            <Eye size={13} />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                          onClick={toggleFullscreen}
                        >
                          {isFullscreen ? <Minimize size={13} /> : <Maximize size={13} />}
                        </Button>
                      </div>
                    )}
                  </div>
                  {selectedFile && (
                    <p className="text-xs truncate mt-1 text-muted-foreground">{selectedFile}</p>
                  )}
                </CardHeader>
                <Separator />
                <CardContent className="p-0 diff-content">
                  <ScrollArea className="h-[calc(100vh-280px)] diff-scroll">
                    {diffLoading && !selectedFromAll ? (
                      <div className="flex items-center justify-center h-32">
                        <RefreshCw size={20} className="animate-spin text-muted-foreground" />
                      </div>
                    ) : selectedFromAll && selectedFile ? (
                      mdRender && isMarkdownFile(selectedFile) ? (
                        <MarkdownView content={mdContent} />
                      ) : rawError ? (
                        <div className="p-4 text-sm text-destructive whitespace-pre-wrap break-words">{rawError}</div>
                      ) : rawContent ? (
                        <CodeView content={rawContent} file={selectedFile} fullPath={selectedFullPath} />
                      ) : (
                        <div className="flex items-center justify-center h-32">
                          <RefreshCw size={20} className="animate-spin text-muted-foreground" />
                        </div>
                      )
                    ) : mdRender && isMarkdownFile(selectedFile ?? "") ? (
                      <MarkdownView content={mdContent} />
                    ) : viewMode === "raw" && selectedFile ? (
                      rawError ? (
                        <div className="p-4 text-sm text-destructive whitespace-pre-wrap break-words">{rawError}</div>
                      ) : rawContent ? (
                        <CodeView content={rawContent} file={selectedFile} fullPath={selectedFullPath} />
                      ) : (
                        <div className="flex items-center justify-center h-32">
                          <RefreshCw size={20} className="animate-spin text-muted-foreground" />
                        </div>
                      )
                    ) : fileDiff ? (
                      <DiffView raw={fileDiff} view={viewMode === "split" ? "split" : "unified"} fullPath={selectedFullPath} />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                        <GitCommit size={24} />
                        <p className="text-sm mt-2">Select a file to view diff</p>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
