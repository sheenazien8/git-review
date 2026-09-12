"use client"

import { useState, useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react"
import { parseDiff } from "@/lib/utils"
import {
  GitBranch,
  GitCommit,
  FilePen,
  FilePlus,
  FileMinus,
  Trash2,
  File,
  ChevronRight,
  ChevronDown,
  PanelLeft,
  Menu,
  RefreshCw,
  Folder,
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
  Save,
  X,
  Search,
} from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
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

const BINARY_EXTS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".ico",
  ".pdf", ".zip", ".tar", ".gz", ".rar", ".7z",
  ".mp3", ".mp4", ".avi", ".mov",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".wasm", ".so", ".dll", ".exe", ".dylib",
])

function isBinaryFile(file: string) {
  const extIndex = file.lastIndexOf(".")
  if (extIndex === -1) return false
  const ext = file.slice(extIndex).toLowerCase()
  return BINARY_EXTS.has(ext)
}

// ---------------------------------------------------------------------------
// Buffer / open tabs
// ---------------------------------------------------------------------------

const TAB_CAP = 20
const TABS_STORAGE_PREFIX = "git-review-tabs-"

// One open editor. The id is stable for the lifetime of the entry and is the
// only key used to look up / mutate / remove an entry from the buffer.
interface BufferEntry {
  id: string
  file: string
  staged: boolean
  fromAll: boolean
  diff: string
  diffLoading: boolean
  raw: string
  rawError: string
  md: string
  mdRender: boolean
  viewMode: "unified" | "split" | "raw"
  editMode: boolean
  editContent: string
  // True when editContent has drifted away from the on-disk content.
  dirty: boolean
  // Optional rename hint from git status (oldPath → file).
  oldPath?: string
}

function makeTabId(repo: string, file: string, staged: boolean, fromAll: boolean) {
  return `${repo}::${file}::${staged ? "s" : "u"}::${fromAll ? "a" : "d"}`
}

function tabsStorageKey(repo: string) {
  // base64 of repoPath keeps weird characters out of the key. The resulting
  // string is used as a suffix only — atob/btoa are available everywhere.
  let b64 = ""
  try {
    b64 = btoa(repo)
  } catch {
    b64 = repo.replace(/[^a-zA-Z0-9_-]/g, "_")
  }
  return `${TABS_STORAGE_PREFIX}${b64}`
}

// Drop fields we don't want to persist — reloading the page always re-fetches
// content; we only restore the *list* of open tabs and which one is active.
type PersistedTab = {
  file: string
  staged: boolean
  fromAll: boolean
}
type PersistedBuffer = { tabs: PersistedTab[]; activeId: string | null }

function readPersistedBuffer(repo: string): PersistedBuffer | null {
  try {
    const raw = localStorage.getItem(tabsStorageKey(repo))
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedBuffer
    if (!parsed || !Array.isArray(parsed.tabs)) return null
    return parsed
  } catch {
    return null
  }
}

function writePersistedBuffer(repo: string, buffer: BufferEntry[], activeId: string | null) {
  try {
    const payload: PersistedBuffer = {
      tabs: buffer.map(b => ({ file: b.file, staged: b.staged, fromAll: b.fromAll })),
      activeId,
    }
    localStorage.setItem(tabsStorageKey(repo), JSON.stringify(payload))
  } catch {
    // localStorage may be unavailable / full — best-effort.
  }
}

// ---------------------------------------------------------------------------
// Sidebar: persisted geometry + All Files tree building
// ---------------------------------------------------------------------------

const SIDEBAR_MIN_WIDTH = 200
const SIDEBAR_MAX_WIDTH = 400
const SIDEBAR_DEFAULT_WIDTH = 280
const SIDEBAR_WIDTH_KEY = "git-review-sidebar-width"
const SIDEBAR_OPEN_KEY = "git-review-sidebar-open"

function clampSidebarWidth(w: number) {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(w)))
}

interface TreeNode {
  name: string
  path: string
  type: "dir" | "file"
  status: string
  children: TreeNode[]
}

// Builds a nested tree from the flat /api/git/all-files entries (both dirs
// and files). Dir nodes carry the status the API derived for them. Nodes
// are sorted dirs-first, then alphabetically, at every level.
function filterTreeNodes(nodes: TreeNode[], query: string): TreeNode[] {
  const q = query.trim().toLowerCase()
  if (!q) return nodes
  const out: TreeNode[] = []
  for (const node of nodes) {
    if (node.type === "file") {
      if (node.name.toLowerCase().includes(q) || node.path.toLowerCase().includes(q)) {
        out.push(node)
      }
    } else {
      const filteredChildren = filterTreeNodes(node.children, query)
      if (filteredChildren.length > 0) {
        out.push({ ...node, children: filteredChildren })
      } else if (node.name.toLowerCase().includes(q) || node.path.toLowerCase().includes(q)) {
        out.push({ ...node, children: [] })
      }
    }
  }
  return out
}

function buildTree(entries: { path: string; status: string; type?: string }[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", type: "dir", status: "", children: [] }
  const dirIndex = new Map<string, TreeNode>([["", root]])

  const ensureDir = (dirPath: string): TreeNode => {
    const existing = dirIndex.get(dirPath)
    if (existing) return existing
    const name = dirPath.split("/").pop() ?? dirPath
    const parentPath = dirPath.includes("/") ? dirPath.slice(0, dirPath.lastIndexOf("/")) : ""
    const node: TreeNode = { name, path: dirPath, type: "dir", status: "", children: [] }
    ensureDir(parentPath).children.push(node)
    dirIndex.set(dirPath, node)
    return node
  }

  for (const entry of entries) {
    const name = entry.path.split("/").pop() ?? entry.path
    if (entry.type === "dir") {
      const dir = ensureDir(entry.path)
      if (!dir.status) dir.status = entry.status
    } else {
      const parentPath = entry.path.includes("/") ? entry.path.slice(0, entry.path.lastIndexOf("/")) : ""
      ensureDir(parentPath).children.push({
        name,
        path: entry.path,
        type: "file",
        status: entry.status,
        children: [],
      })
    }
  }

  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1
    )
    for (const n of nodes) if (n.type === "dir") sortNodes(n.children)
  }
  sortNodes(root.children)
  return root.children
}

function DiffView({ raw, view, fullPath }: { raw: string; view: "unified" | "split"; fullPath: string }) {
  const hunks = parseDiff(raw)
  const { copiedKey, anchor, click, rangePreview, setHover } = useCopyRange(fullPath)

  if (hunks.length === 0) {
    const rename = raw.match(/^rename from (.+)\nrename to (.+)$/m)
    if (rename) {
      return (
        <div className="p-4 text-sm">
          <div className="rounded border bg-muted/40 p-3 font-mono text-xs">
            <div className="text-muted-foreground">similarity index 100%</div>
            <div>rename from <span className="font-semibold">{rename[1]}</span></div>
            <div>rename to <span className="font-semibold">{rename[2]}</span></div>
          </div>
        </div>
      )
    }
    return <div className="p-4 text-center text-sm text-muted-foreground">No diff output</div>
  }

  const addBg = "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300"
  const removeBg = "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300"
  const ctxText = "text-neutral-700 dark:text-neutral-300"
  const hunkBg = "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"

  // While a line is anchored, hovering another line previews the range that
  // the second click would copy.
  const inRange = (lineNo: number | undefined) =>
    rangePreview != null && lineNo != null && lineNo >= rangePreview[0] && lineNo <= rangePreview[1]

  return (
    <div className="font-mono text-xs" onMouseLeave={() => setHover(null)}>
      {hunks.map((hunk, hi) => (
        <table key={hi} className="min-w-full border-collapse">
          <thead>
            <tr>
              <td
                colSpan={view === "split" ? 2 : 3}
                className={`${hunkBg} px-2 py-1 sticky top-0 z-10`}
              >
                {hunk.header}
              </td>
            </tr>
          </thead>
          <tbody>
            {hunk.lines.map((line, li) => {
              const key = `${view === "split" ? "s" : "u"}-${hi}-${li}`
              const lineNo = line.type === "remove" ? line.oldLineNo : line.newLineNo
              const isAnchor = anchor === lineNo
              const isRange = inRange(lineNo)
              const numCls = isAnchor
                ? "bg-primary! text-primary-foreground!"
                : isRange
                  ? "bg-primary/15!"
                  : ""

              if (view === "split") {
                const copied = copiedKey === key
                const shown = line.type === "add" ? undefined : line.oldLineNo
                const contentBg = line.type === "add" ? addBg : line.type === "remove" ? removeBg : ctxText
                return (
                  <tr
                    key={li}
                    title={copyTitleFor(fullPath, anchor, lineNo ?? 0)}
                    onClick={() => click(lineNo, key)}
                    onMouseEnter={() => setHover(lineNo ?? null)}
                    className="cursor-pointer"
                  >
                    <td className={`w-10 select-none border-r border-border bg-muted text-right text-xs text-muted-foreground pr-1 ${numCls}`}>
                      {copied ? <Check size={12} className="inline-block align-middle" /> : isAnchor ? lineNo : shown ?? ""}
                    </td>
                    <td className={`whitespace-pre pl-1 ${contentBg}`}>{line.content}</td>
                  </tr>
                )
              }

              const copied = copiedKey === key
              const bg = line.type === "add" ? addBg : line.type === "remove" ? removeBg : ""
              const text = line.type === "add" ? "" : line.type === "remove" ? "" : ctxText
              const prefix = line.type === "add" ? "+" : line.type === "remove" ? "-" : " "
              return (
                <tr
                  key={li}
                  title={copyTitleFor(fullPath, anchor, lineNo ?? 0)}
                  onClick={() => click(lineNo, key)}
                  onMouseEnter={() => setHover(lineNo ?? null)}
                  className={`cursor-pointer ${bg} ${text}`}
                >
                  <td className={`w-12 select-none border-r border-border text-right pr-2 ${numCls || "text-muted-foreground"}`}>
                    {copied ? <Check size={12} className="inline-block align-middle" /> : lineNo ?? ""}
                  </td>
                  <td className="w-5 select-none text-center">{prefix}</td>
                  <td className="whitespace-pre pl-2">{line.content}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
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

function EditView({ content, file, onChange }: { content: string; file: string; onChange: (v: string) => void }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const preRef = useRef<HTMLPreElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)

  const ext = file.split(".").pop()?.toLowerCase() ?? ""
  const lang = extToLang[ext]

  const highlightedHtml = useMemo(() => {
    try {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(content, { language: lang, ignoreIllegals: true }).value
      }
      return hljs.highlightAuto(content).value
    } catch {
      return content
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
    }
  }, [content, lang])

  const lines = useMemo(() => content.split("\n"), [content])

  const handleScroll = useCallback(() => {
    const ta = textareaRef.current
    if (!ta || !preRef.current || !gutterRef.current) return
    preRef.current.scrollTop = ta.scrollTop
    preRef.current.scrollLeft = ta.scrollLeft
    gutterRef.current.scrollTop = ta.scrollTop
  }, [])

  return (
    <div className="flex h-full text-xs font-mono">
      <div
        ref={gutterRef}
        className="shrink-0 select-none overflow-hidden border-r border-border bg-muted/30 py-4 pr-2 pl-3 text-right text-muted-foreground leading-5"
      >
        {lines.map((_, i) => (
          <div key={i} className="h-5">{i + 1}</div>
        ))}
      </div>
      <div className="relative flex-1">
        <pre
          ref={preRef}
          className="absolute inset-0 m-0 overflow-hidden p-4 leading-5"
          style={{ whiteSpace: "pre", overflowWrap: "normal", wordWrap: "normal", tabSize: 2 }}
        >
          <code className="hljs p-0! bg-transparent!" dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
          {/* Pad with extra newlines so the pre element always has a bit more
              scrollable height than the textarea, keeping cursor alignment
              accurate at the end of the file. */}
          <span dangerouslySetInnerHTML={{ __html: "\n\n\n\n\n\n\n\n\n\n" }} />
        </pre>
        <textarea
          ref={textareaRef}
          className="absolute inset-0 h-full w-full resize-none bg-transparent p-4 leading-5 text-transparent outline-none"
          style={{ whiteSpace: "pre", overflowWrap: "normal", wordWrap: "normal", tabSize: 2, caretColor: "var(--foreground)" }}
          value={content}
          onChange={e => onChange(e.target.value)}
          onScroll={handleScroll}
          spellCheck={false}
        />
      </div>
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
  // --- Open-files buffer -------------------------------------------------
  // All state that used to describe a single selected file now lives inside a
  // BufferEntry. The list of entries is the buffer; activeId picks the one
  // the diff card renders. Mutations always go through `updateEntry` /
  // `setBuffer` so React stays the source of truth.
  const [buffer, setBuffer] = useState<BufferEntry[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  // Tracks the currently mounted repo key so we can persist buffer changes
  // back to the right localStorage slot without re-running on each setState.
  const persistedRepoRef = useRef<string>("")
  // Used by the repo selector / mount-time URL parse to coordinate the
  // initial persistence restore (similar to sidebarMountedRef).
  const bufferMountedRef = useRef(false)
  // Tracks ids whose diff fetch is currently in flight. This is a *synchronous*
  // mirror of BufferEntry.diffLoading — React state updates batched inside a
  // single event tick can't be observed by sibling clicks, so rapid clicks on
  // the same file would all see diffLoading=false and queue duplicate fetches.
  // We mirror the flag here so the second click in the same tick is a no-op.
  const inFlightRef = useRef<Set<string>>(new Set())
  const [error, setError] = useState("")
  const [allFiles, setAllFiles] = useState<{ path: string; status: string; type?: string }[]>([])
  const [commitMsg, setCommitMsg] = useState("")
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [actionResult, setActionResult] = useState<{ ok: boolean; message: string } | null>(null)
  const diffCardRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const saveFileRef = useRef<() => Promise<void>>(async () => {})
  // Dialog states
  const [createFileOpen, setCreateFileOpen] = useState(false)
  const [createFileName, setCreateFileName] = useState("")
  const [deleteFileOpen, setDeleteFileOpen] = useState(false)
  const [fileToDelete, setFileToDelete] = useState<string | null>(null)
  const [fileSearch, setFileSearch] = useState("")

  // --- Sidebar (VS Code-style) state --------------------------------------
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  // On mobile the sidebar lives in a Sheet overlay instead of the aside.
  const [mobileOpen, setMobileOpen] = useState(false)
  // Expanded dir paths in the "All Files" tree.
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => new Set())


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

  // --- Sidebar behavior ----------------------------------------------------

  // Restore persisted sidebar geometry once on mount. (Set-state is
  // intentional here: SSR renders the defaults, so persisted geometry can
  // only be applied after hydration — same rationale as the theme system.)
  useEffect(() => {
    try {
      const storedWidth = parseInt(localStorage.getItem(SIDEBAR_WIDTH_KEY) ?? "", 10)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring persisted UI geometry from localStorage after hydration; SSR must render defaults
      if (!Number.isNaN(storedWidth)) setSidebarWidth(clampSidebarWidth(storedWidth))
      const storedOpen = localStorage.getItem(SIDEBAR_OPEN_KEY)
      if (storedOpen !== null) setSidebarOpen(storedOpen === "true")
    } catch {
      // localStorage unavailable — defaults are fine
    }
  }, [])

  // Persist the open/closed state on every change (skipping the first,
  // still-default render so the restored value is never clobbered).
  const sidebarMountedRef = useRef(false)
  useEffect(() => {
    if (!sidebarMountedRef.current) {
      sidebarMountedRef.current = true
      return
    }
    try {
      localStorage.setItem(SIDEBAR_OPEN_KEY, String(sidebarOpen))
    } catch {}
  }, [sidebarOpen])

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(open => !open)
  }, [])

  // Drag the sidebar's right edge to resize (clamped 200–400px, persisted
  // on release). Double-clicking the handle resets to the default width.
  const widthRef = useRef(SIDEBAR_DEFAULT_WIDTH)
  const startResize = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      const startX = e.clientX
      const startWidth = sidebarWidth
      widthRef.current = startWidth
      setIsResizing(true)
      document.body.style.userSelect = "none"
      document.body.style.cursor = "col-resize"
      const onMove = (ev: PointerEvent) => {
        widthRef.current = clampSidebarWidth(startWidth + ev.clientX - startX)
        setSidebarWidth(widthRef.current)
      }
      const onUp = () => {
        document.removeEventListener("pointermove", onMove)
        document.removeEventListener("pointerup", onUp)
        document.body.style.userSelect = ""
        document.body.style.cursor = ""
        setIsResizing(false)
        try {
          localStorage.setItem(SIDEBAR_WIDTH_KEY, String(widthRef.current))
        } catch {}
      }
      document.addEventListener("pointermove", onMove)
      document.addEventListener("pointerup", onUp)
    },
    [sidebarWidth]
  )

  const loadAllFiles = useCallback(async (repo?: string) => {
    const target = repo ?? repoPath
    try {
      const res = await fetch(`/api/git/all-files?repo=${encodeURIComponent(target)}`)
      const data = await res.json()
      if (!data.error) {
        setAllFiles(data.files || [])
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

  // --- Buffer helpers ---------------------------------------------------
  // Updates the entry that matches `id` (or every entry when id === "*").
  // Returns a new array so React detects the change — never mutate entries
  // in place.
  const updateEntry = useCallback(
    (id: string, patch: Partial<BufferEntry>) => {
      setBuffer(prev =>
        prev.map(b => (b.id === id ? { ...b, ...patch } : b))
      )
    },
    []
  )

  // Find or create the tab for (file, staged, fromAll) and return its id.
  // The repo path is captured in the id so a stale id from a different repo
  // never resolves to a live entry. Rapid clicks resolve to a single entry:
  // the setBuffer callback dedupes by id so we never get duplicate tabs even
  // if multiple synchronous clicks race against a pending React update.
  const ensureTab = useCallback(
    (file: string, staged: boolean, fromAll: boolean, oldPath?: string): string => {
      const id = makeTabId(repoPath, file, staged, fromAll)
      const created: BufferEntry = {
        id,
        file,
        staged,
        fromAll,
        diff: "",
        diffLoading: false,
        raw: "",
        rawError: "",
        md: "",
        mdRender: false,
        viewMode: "split",
        editMode: false,
        editContent: "",
        dirty: false,
        oldPath,
      }
      setBuffer(prev => {
        if (prev.some(b => b.id === id)) return prev
        const next = [...prev, created]
        // Soft cap: evict the oldest non-active, non-dirty tab when full.
        // If everything is dirty we still drop the oldest to keep the strip
        // usable — the user's edits are preserved on disk for the active
        // tab; the rest still live in their entries and can be re-opened
        // via the sidebar.
        if (next.length <= TAB_CAP) return next
        const evictIdx = next.findIndex(b => !b.dirty)
        const dropAt = evictIdx === -1 ? 0 : evictIdx
        return [...next.slice(0, dropAt), ...next.slice(dropAt + 1)]
      })
      return id
    },
    [repoPath]
  )

  const active = useMemo(
    () => (activeId ? buffer.find(b => b.id === activeId) ?? null : null),
    [buffer, activeId]
  )

  // --- Loaders that target the buffer ----------------------------------

  // Reads the file's raw content into the given entry. Returns the content
  // so callers (toggleEditMode) can keep their synchronous lookups.
  const fetchRaw = useCallback(async (entry: BufferEntry): Promise<string> => {
    try {
      const res = await fetch(`/api/git/content?repo=${encodeURIComponent(repoPath)}&file=${encodeURIComponent(entry.file)}`)
      const data = await res.json()
      if (data.error) {
        updateEntry(entry.id, { rawError: data.error, raw: "" })
        return ""
      }
      updateEntry(entry.id, { rawError: "", raw: data.content ?? "" })
      return data.content ?? ""
    } catch (e) {
      updateEntry(entry.id, {
        rawError: e instanceof Error ? e.message : "Failed to read file",
        raw: "",
      })
      return ""
    }
  }, [repoPath, updateEntry])

  // Fetches both diff and (when needed) raw content for the entry, writing
  // into the entry's slots. fromAll entries (files opened from the All Files
  // tree that have no diff) always pull raw content; entries with a diff
  // only pull raw when the user has switched to raw view mode.
  const fetchEntry = useCallback(async (entry: BufferEntry) => {
    inFlightRef.current.add(entry.id)
    updateEntry(entry.id, { diffLoading: true })
    try {
      if (!entry.fromAll) {
        const oldPathQS = entry.oldPath
          ? `&oldPath=${encodeURIComponent(entry.oldPath)}`
          : ""
        const res = await fetch(
          `/api/git/diff?repo=${encodeURIComponent(repoPath)}&file=${encodeURIComponent(entry.file)}&staged=${entry.staged ? 1 : 0}${oldPathQS}`
        )
        const data = await res.json()
        updateEntry(entry.id, { diff: data.diff || "" })
      } else {
        updateEntry(entry.id, { diff: "" })
      }
      if (entry.fromAll || entry.viewMode === "raw") {
        await fetchRaw(entry)
      }
    } catch {
      updateEntry(entry.id, { diff: "" })
    } finally {
      inFlightRef.current.delete(entry.id)
      updateEntry(entry.id, { diffLoading: false })
    }
  }, [repoPath, fetchRaw, updateEntry])

  // Sidebar click — the unified open/activate handler. Either creates a
  // new tab or activates the existing one; either way the entry's content
  // is re-fetched so the user always sees the file's current state.
  const openOrActivateTab = useCallback(
    (file: string, staged: boolean, fromAll: boolean, oldPath?: string) => {
      const id = makeTabId(repoPath, file, staged, fromAll)
      const existing = buffer.find(b => b.id === id)
      // In-flight guard: if a refetch is already running for this entry the
      // click is a no-op so we never queue duplicate fetches. We check both
      // the synchronous ref and the buffered flag — the ref covers rapid
      // clicks within one event tick, the buffered flag covers clicks
      // separated by a render.
      if (inFlightRef.current.has(id)) {
        setActiveId(id)
        return
      }
      if (existing?.diffLoading) {
        setActiveId(id)
        return
      }
      // If we have an existing entry in this render's buffer, use it for the
      // fetch. Otherwise build a transient entry shape to pass to fetchEntry;
      // ensureTab's setBuffer callback dedupes any race with another sync
      // click so we never end up with duplicate ids.
      const target: BufferEntry = existing ?? {
        id,
        file,
        staged,
        fromAll,
        diff: "",
        diffLoading: false,
        raw: "",
        rawError: "",
        md: "",
        mdRender: false,
        viewMode: "split",
        editMode: false,
        editContent: "",
        dirty: false,
        oldPath,
      }
      ensureTab(file, staged, fromAll, oldPath)
      setActiveId(id)
      void fetchEntry(target)
    },
    [buffer, repoPath, ensureTab, fetchEntry]
  )

  const closeTab = useCallback((id: string) => {
    // Compute the next active id from the current buffer synchronously, then
    // commit both updates. Using the stale closure's buffer is fine here
    // because the operation is idempotent and the next click will re-resolve.
    const removedIdx = buffer.findIndex(b => b.id === id)
    let nextActive: string | null = activeId
    if (removedIdx !== -1 && activeId === id) {
      const remaining = buffer.filter(b => b.id !== id)
      nextActive = remaining.length === 0
        ? null
        : remaining[Math.min(removedIdx, remaining.length - 1)].id
    } else if (activeId === id) {
      nextActive = null
    }
    setBuffer(prev => prev.filter(b => b.id !== id))
    setActiveId(nextActive)
  }, [buffer, activeId])

  // Refreshes the content of an entry without changing which tab is active.
  // Used by the tab's refresh button; clicking the tab itself also calls this.
  const refreshTab = useCallback((entry: BufferEntry) => {
    if (inFlightRef.current.has(entry.id) || entry.diffLoading) return
    setActiveId(entry.id)
    void fetchEntry(entry)
  }, [fetchEntry])

  // Persist the buffer back to localStorage whenever it changes — but only
  // after the initial mount/restore has happened so we don't clobber the
  // stored list with the empty seed.
  useEffect(() => {
    if (!bufferMountedRef.current) return
    writePersistedBuffer(persistedRepoRef.current, buffer, activeId)
  }, [buffer, activeId])

  // --- All Files tree + selection helpers --------------------------------

  const toggleDir = useCallback((dirPath: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev)
      if (next.has(dirPath)) next.delete(dirPath)
      else next.add(dirPath)
      return next
    })
  }, [])

  // Expands every ancestor directory of `filePath` in the All Files tree so
  // the selected file stays visible there no matter which section it was
  // picked from.
  const expandAncestors = useCallback((filePath: string) => {
    if (!filePath.includes("/")) return
    setExpandedDirs(prev => {
      let changed = false
      const next = new Set(prev)
      const segments = filePath.split("/")
      for (let i = 1; i < segments.length; i++) {
        const dir = segments.slice(0, i).join("/")
        if (!next.has(dir)) {
          next.add(dir)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [])

  // Selecting a file from the All Files tree shows its raw content (no
  // diff) unless the file has uncommitted changes, in which case we show the
  // diff so the view is consistent with the Changes/Staged sections.
  const selectFromTree = useCallback(
    (filePath: string) => {
      const matched = files.find(f => f.path === filePath)
      expandAncestors(filePath)
      if (matched) {
        // File has uncommitted changes — show diff so the view matches the
        // Changes/Staged sections.
        openOrActivateTab(filePath, matched.staged, false, matched.oldPath)
      } else {
        openOrActivateTab(filePath, false, true)
      }
    },
    [files, openOrActivateTab, expandAncestors]
  )

  // Triggered from the Changes/Staged tree rows. Equivalent to opening a
  // new tab for (file, staged, false).
  const loadDiff = useCallback(
    (file: string, staged: boolean) => {
      expandAncestors(file)
      const matched = files.find(f => f.path === file && f.staged === staged)
      openOrActivateTab(file, staged, false, matched?.oldPath)
    },
    [files, openOrActivateTab, expandAncestors]
  )

  const runAction = useCallback(async (
    action: "add" | "addAll" | "unstage" | "unstageAll" | "commit" | "push" | "create" | "delete",
    payload?: { files?: string[]; message?: string; path?: string }
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
        // looking at — keep the active tab focused and update its staged flag
        // in place rather than spawning a second tab. The user can still
        // open the other staged/unstaged variant manually from the sidebar.
        if (fresh && active && (action === "addAll" || action === "unstageAll" || payload?.files?.includes(active.file))) {
          const nowStaged = fresh.some(f => f.path === active.file && f.staged)
          const matched = fresh.find(f => f.path === active.file && f.staged === nowStaged)
          updateEntry(active.id, { staged: nowStaged, oldPath: matched?.oldPath })
          void fetchEntry({ ...active, staged: nowStaged, oldPath: matched?.oldPath })
        }
        // Refresh all-files list after create/delete
        if (action === "create" || action === "delete") {
          loadAllFiles()
          if (action === "create" && payload?.path) {
            selectFromTree(payload.path)
          }
        }
      }
    } catch (e) {
      setActionResult({ ok: false, message: e instanceof Error ? e.message : "Action failed" })
    } finally {
      setBusyAction(null)
    }
  }, [repoPath, loadStatus, active, updateEntry, loadAllFiles, selectFromTree, fetchEntry])

  const loadMarkdown = useCallback(async (entry: BufferEntry) => {
    try {
      const res = await fetch(`/api/git/content?repo=${encodeURIComponent(repoPath)}&file=${encodeURIComponent(entry.file)}`)
      const data = await res.json()
      updateEntry(entry.id, { md: data.content ?? "" })
    } catch {
      updateEntry(entry.id, { md: "" })
    }
  }, [repoPath, updateEntry])

  const canEdit = useCallback((file: string | null) => {
    if (!file) return false
    if (isBinaryFile(file)) return false
    const f = files.find(gf => gf.path === file)
    if (f?.status === "deleted") return false
    return true
  }, [files])

  const toggleEditMode = useCallback(async () => {
    if (!active) return
    if (!active.editMode) {
      if (!canEdit(active.file)) return
      let content = active.raw
      if (!content || active.rawError) {
        content = await fetchRaw(active)
      }
      updateEntry(active.id, {
        viewMode: "split", // any future value works; raw is irrelevant while editing
        editMode: true,
        editContent: content,
        dirty: false,
        mdRender: false,
      })
    } else {
      updateEntry(active.id, { editMode: false, editContent: "", dirty: false })
    }
  }, [active, canEdit, fetchRaw, updateEntry])

  const saveFile = useCallback(async () => {
    if (!active || active.editContent === active.raw) return
    setIsSaving(true)
    setActionResult(null)
    try {
      const res = await fetch(`/api/git/content?repo=${encodeURIComponent(repoPath)}&file=${encodeURIComponent(active.file)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: active.editContent }),
      })
      const data = await res.json()
      if (data.error) {
        setActionResult({ ok: false, message: data.error })
      } else {
        setActionResult({ ok: true, message: "File saved" })
        updateEntry(active.id, { editMode: false, editContent: "", dirty: false, raw: active.editContent })
        await loadStatus()
        // Re-fetch the entry so any diff on the active tab reflects the saved
        // state and stale cached entries on other tabs also refresh.
        const refreshed = buffer.find(b => b.id === active.id)
        if (refreshed) await fetchEntry(refreshed)
      }
    } catch (e) {
      setActionResult({ ok: false, message: e instanceof Error ? e.message : "Failed to save file" })
    } finally {
      setIsSaving(false)
    }
  }, [active, repoPath, loadStatus, buffer, fetchEntry, updateEntry])

  useEffect(() => {
    saveFileRef.current = saveFile
  }, [saveFile])

  const handleCreateFile = useCallback(async () => {
    if (!createFileName.trim()) return
    setCreateFileOpen(false)
    await runAction("create", { path: createFileName.trim() })
    setCreateFileName("")
  }, [createFileName, runAction])

  const handleDeleteFile = useCallback(async () => {
    if (!fileToDelete) return
    setDeleteFileOpen(false)
    const wasActive = active?.file === fileToDelete
    await runAction("delete", { files: [fileToDelete] })
    if (wasActive) {
      closeTab(active!.id)
    }
    setFileToDelete(null)
  }, [fileToDelete, active, runAction, closeTab])

  const openDeleteDialog = useCallback((filePath: string) => {
    setFileToDelete(filePath)
    setDeleteFileOpen(true)
  }, [])

  const didInitialLoadRef = useRef(false)
  useEffect(() => {
    if (didInitialLoadRef.current) return
    didInitialLoadRef.current = true
    // Apply ?project=<name> from the URL if it matches a known project. The
    // match is case-sensitive and exact (per the plan). Unknown values are
    // silently ignored — the URL is left as the user typed it for debugging.
    try {
      const params = new URLSearchParams(window.location.search)
      const name = params.get("project")
      if (name) {
        const match = projects.projects.find(p => p.name === name)
        if (match && match.dir !== repoPath) {
          // Snapshot the outgoing repo's buffer so coming back later restores
          // the user's tabs. The buffer-mount guard hasn't fired yet so the
          // persistence effect won't have written anything — persist now.
          writePersistedBuffer(repoPath, buffer, activeId)
          // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot URL → state hydration on mount; the didInitialLoadRef guard makes this never run again
          setRepoPath(match.dir)
          persistedRepoRef.current = match.dir
        } else {
          persistedRepoRef.current = repoPath
        }
      } else {
        persistedRepoRef.current = repoPath
      }
    } catch {
      persistedRepoRef.current = repoPath
    }
    // Restore any previously open tabs for the now-active repo. Runs once
    // after the URL parse so the buffer is consistent with the URL.
    const restoreRepo = persistedRepoRef.current
    const restored = readPersistedBuffer(restoreRepo)
    if (restored && restored.tabs.length > 0) {
      const seeded: BufferEntry[] = restored.tabs.map(t => ({
        id: makeTabId(restoreRepo, t.file, t.staged, t.fromAll),
        file: t.file,
        staged: t.staged,
        fromAll: t.fromAll,
        diff: "",
        diffLoading: false,
        raw: "",
        rawError: "",
        md: "",
        mdRender: false,
        viewMode: "split",
        editMode: false,
        editContent: "",
        dirty: false,
      }))
      setBuffer(seeded)
      const validActive = restored.activeId && seeded.some(b => b.id === restored.activeId)
        ? restored.activeId
        : seeded[0]?.id ?? null
      setActiveId(validActive)
    }
    bufferMountedRef.current = true
    loadStatus(persistedRepoRef.current)
  }, [loadStatus, repoPath, buffer, activeId])

  // After loadStatus finishes (files populated), kick off the active tab's
  // content fetch. Files are needed so oldPath can be resolved for renames;
  // without waiting we may render the diff without the rename hint.
  const activeRefetchedRef = useRef(false)
  useEffect(() => {
    if (activeRefetchedRef.current) return
    if (!active || active.diffLoading) return
    if (loading) return
    activeRefetchedRef.current = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchEntry is the same effect-trigger we just guarded against re-running; we only call it once per active entry
    void fetchEntry(active)
  }, [active, loading, fetchEntry])

  // Reset the active-refetch guard on repo switch so the new active tab
  // gets its initial fetch when files arrive, and on every activeId change
  // so switching tabs via the sidebar always re-fetches the new active.
  useEffect(() => {
    activeRefetchedRef.current = false
  }, [repoPath, activeId])

  // Ctrl/Cmd+B toggles the sidebar (VS Code muscle memory).
  // Ctrl/Cmd+W closes the active tab; Ctrl/Cmd+Tab / PageUp/PageDown cycle
  // tabs. Ctrl/Cmd+S saves when the active tab is in edit mode.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      const key = e.key.toLowerCase()
      if (key === "b") {
        e.preventDefault()
        toggleSidebar()
        return
      }
      if (key === "s") {
        if (active?.editMode) {
          e.preventDefault()
          saveFileRef.current()
        }
        return
      }
      if (key === "w" && active) {
        e.preventDefault()
        if (active.dirty && !window.confirm("Discard unsaved changes?")) return
        closeTab(active.id)
        return
      }
      if (key === "tab" || e.key === "PageDown" || e.key === "PageUp") {
        if (buffer.length < 2) return
        e.preventDefault()
        const idx = buffer.findIndex(b => b.id === activeId)
        const dir = key === "tab" ? (e.shiftKey ? -1 : 1) : e.key === "PageDown" ? 1 : -1
        const next = (idx + dir + buffer.length) % buffer.length
        const target = buffer[next]
        if (target) {
          // Keyboard tab cycling is instant — same as clicking the tab.
          // Use the per-tab refresh button if you want fresh content.
          setActiveId(target.id)
        }
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [toggleSidebar, active, buffer, activeId, closeTab, fetchEntry])

  const changesFiles = files.filter(f => !f.staged)
  const stagedFiles = files.filter(f => f.staged)

  const fileTree = useMemo(() => buildTree(allFiles), [allFiles])
  const changesTree = useMemo(() => buildTree(changesFiles.map(f => ({ path: f.path, status: f.status }))), [changesFiles])
  const stagedTree = useMemo(() => buildTree(stagedFiles.map(f => ({ path: f.path, status: f.status }))), [stagedFiles])
  const filteredFileTree = useMemo(() => filterTreeNodes(fileTree, fileSearch), [fileTree, fileSearch])
  const filteredChangesTree = useMemo(() => filterTreeNodes(changesTree, fileSearch), [changesTree, fileSearch])
  const filteredStagedTree = useMemo(() => filterTreeNodes(stagedTree, fileSearch), [stagedTree, fileSearch])
  const hasFileSearch = fileSearch.trim().length > 0

  const selectedFullPath = active ? (repoPath ? `${repoPath}/${active.file}` : active.file) : ""

  const handleRowKeyDown = (
    e: React.KeyboardEvent<HTMLDivElement>,
    opts: { activate?: () => void; dirPath?: string }
  ) => {
    if (e.key === "Enter" || e.key === " ") {
      if (opts.activate) {
        e.preventDefault()
        opts.activate()
      }
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      const container = e.currentTarget.closest("[data-sidebar-body]")
      const rows = container
        ? Array.from(container.querySelectorAll<HTMLElement>("[data-file-row]"))
        : []
      const i = rows.indexOf(e.currentTarget)
      rows[i + (e.key === "ArrowDown" ? 1 : -1)]?.focus()
    } else if (opts.dirPath && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
      const expanded = expandedDirs.has(opts.dirPath)
      if ((e.key === "ArrowRight") !== expanded) {
        e.preventDefault()
        toggleDir(opts.dirPath)
      }
    }
  }

  const renderSkeletonRows = (count = 5) => (
    <div className="space-y-2 px-2 py-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <Skeleton className="size-4 shrink-0 rounded" />
          <Skeleton className="h-3.5 flex-1" />
        </div>
      ))}
    </div>
  )

  const renderTreeNodes = (nodes: TreeNode[], depth: number, onNavigate: () => void) => (
    <>
      {nodes.map((node) => {
        const isDir = node.type === "dir"
        const expanded = isDir && (hasFileSearch || expandedDirs.has(node.path))
        const isActive = !isDir && active?.file === node.path
        const activate = () => {
          if (isDir) {
            toggleDir(node.path)
          } else {
            selectFromTree(node.path)
            onNavigate()
          }
        }
        return (
          <div key={node.path}>
            <div
              data-file-row
              tabIndex={0}
              role="button"
              onClick={activate}
              onKeyDown={e =>
                handleRowKeyDown(e, {
                  activate,
                  dirPath: isDir ? node.path : undefined,
                })
              }
              style={{ paddingLeft: 8 + depth * 12 }}
              className={`group flex items-center gap-1 rounded-md py-1.5 pr-1 text-xs outline-none transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-ring ${isActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent hover:text-accent-foreground"}`}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                    {isDir ? (
                      <ChevronDown
                        size={14}
                        className={`shrink-0 text-muted-foreground transition-transform ${expanded ? "" : "-rotate-90"}`}
                      />
                    ) : (
                      <span className="w-3.5 shrink-0" />
                    )}
                    <span className={`shrink-0 ${isActive ? "text-primary-foreground" : "text-muted-foreground"}`}>
                      {isDir ? <Folder size={14} /> : node.status === "untracked" ? <Plus size={14} /> : <File size={14} />}
                    </span>
                    <span className={`flex-1 truncate ${isDir ? "font-medium" : ""}`}>{node.name}</span>
                    {node.status === "untracked" && (
                      <span
                        className={`shrink-0 rounded border px-1.5 py-0 text-[10px] ${isActive ? "bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30" : "bg-muted text-muted-foreground border-border"}`}
                      >
                        {statusLabel("untracked")}
                      </span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="text-xs">{node.path}</p>
                </TooltipContent>
              </Tooltip>
              {!isDir && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  disabled={!!busyAction}
                  onClick={(e) => {
                    e.stopPropagation()
                    openDeleteDialog(node.path)
                  }}
                  title="Delete file"
                >
                  <Trash2 size={12} />
                </Button>
              )}
            </div>
            {isDir && expanded && renderTreeNodes(node.children, depth + 1, onNavigate)}
          </div>
        )
      })}
    </>
  )

  function collectFilePaths(node: TreeNode): string[] {
    if (node.type === "file") return [node.path]
    return node.children.flatMap(collectFilePaths)
  }

  const renderGitTreeNodes = (nodes: TreeNode[], depth: number, onNavigate: () => void, staged: boolean) => (
    <>
      {nodes.map((node) => {
        const isDir = node.type === "dir"
        const expanded = isDir && (hasFileSearch || expandedDirs.has(node.path))
        const isActive = !isDir && active?.file === node.path
        const activate = () => {
          if (isDir) {
            toggleDir(node.path)
          } else {
            loadDiff(node.path, staged)
            onNavigate()
          }
        }
        const dirAction = isDir
          ? () => runAction(staged ? "unstage" : "add", { files: collectFilePaths(node) })
          : undefined
        return (
          <div key={node.path}>
            <div
              data-file-row
              tabIndex={0}
              role="button"
              onClick={activate}
              onKeyDown={e =>
                handleRowKeyDown(e, {
                  activate,
                  dirPath: isDir ? node.path : undefined,
                })
              }
              style={{ paddingLeft: 8 + depth * 12 }}
              className={`group flex items-center gap-1 rounded-md py-1.5 pr-1 text-xs outline-none transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-ring ${isActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent hover:text-accent-foreground"}`}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                    {isDir ? (
                      <ChevronDown
                        size={14}
                        className={`shrink-0 text-muted-foreground transition-transform ${expanded ? "" : "-rotate-90"}`}
                      />
                    ) : (
                      <span className="w-3.5 shrink-0" />
                    )}
                    <span className={`shrink-0 ${isActive ? "text-primary-foreground" : "text-muted-foreground"}`}>
                      {isDir ? <Folder size={14} /> : statusIcon(node.status)}
                    </span>
                    <span className={`flex-1 truncate ${isDir ? "font-medium" : ""}`}>{node.name}</span>
                    {!isDir && node.status !== "untracked" && (
                      <span
                        className={`shrink-0 rounded border px-1.5 py-0 text-[10px] ${isActive ? "bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30" : statusBadgeColor(node.status)}`}
                      >
                        {statusLabel(node.status)}
                      </span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="text-xs">{node.path}</p>
                </TooltipContent>
              </Tooltip>
              {dirAction && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0 opacity-100"
                  disabled={!!busyAction}
                  onClick={(e) => {
                    e.stopPropagation()
                    dirAction()
                  }}
                  title={staged ? "Unstage all files in this directory" : "Stage all files in this directory"}
                >
                  {staged ? <Minus size={12} /> : <Plus size={12} />}
                </Button>
              )}
            </div>
            {isDir && expanded && renderGitTreeNodes(node.children, depth + 1, onNavigate, staged)}
          </div>
        )
      })}
    </>
  )

  const sidebarContent = (onNavigate: () => void) => (
    <Tabs defaultValue="changes" className="flex flex-col">
      <div className="px-2 pt-2">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search files…"
            value={fileSearch}
            onChange={e => setFileSearch(e.target.value)}
            className="h-8 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
      <TabsList className="mx-2 mt-2 grid grid-cols-3">
        <TabsTrigger value="changes" className="text-xs">
          Changes <span className="ml-1 rounded border border-border bg-muted px-1.5 py-0 text-[10px] tabular-nums text-muted-foreground">{changesFiles.length}</span>
        </TabsTrigger>
        <TabsTrigger value="staged" className="text-xs">
          Staged <span className="ml-1 rounded border border-border bg-muted px-1.5 py-0 text-[10px] tabular-nums text-muted-foreground">{stagedFiles.length}</span>
        </TabsTrigger>
        <TabsTrigger value="all" className="text-xs">
          All Files <span className="ml-1 rounded border border-border bg-muted px-1.5 py-0 text-[10px] tabular-nums text-muted-foreground">{allFiles.length}</span>
        </TabsTrigger>
      </TabsList>
      <div className="mt-2 space-y-0">
        <TabsContent value="changes" className="mt-0 px-2">
          {loading && changesFiles.length === 0 ? (
            renderSkeletonRows()
          ) : changesFiles.length === 0 ? (
            <p className="px-2 py-2 text-[11px] text-muted-foreground">No changes</p>
          ) : filteredChangesTree.length === 0 ? (
            <p className="px-2 py-2 text-[11px] text-muted-foreground">No matches</p>
          ) : (
            <div className="pb-1">{renderGitTreeNodes(filteredChangesTree, 0, onNavigate, false)}</div>
          )}
        </TabsContent>
        <TabsContent value="staged" className="mt-0 px-2">
          {loading && stagedFiles.length === 0 ? (
            renderSkeletonRows(3)
          ) : stagedFiles.length === 0 ? (
            <p className="px-2 py-2 text-[11px] text-muted-foreground">Nothing staged</p>
          ) : filteredStagedTree.length === 0 ? (
            <p className="px-2 py-2 text-[11px] text-muted-foreground">No matches</p>
          ) : (
            <div className="pb-1">{renderGitTreeNodes(filteredStagedTree, 0, onNavigate, true)}</div>
          )}
        </TabsContent>
        <TabsContent value="all" className="mt-0 px-2">
          {allFiles.length === 0 ? (
            renderSkeletonRows(6)
          ) : filteredFileTree.length === 0 ? (
            <p className="px-2 py-2 text-[11px] text-muted-foreground">No matches</p>
          ) : (
            <div className="pb-1">{renderTreeNodes(filteredFileTree, 0, onNavigate)}</div>
          )}
        </TabsContent>
      </div>
    </Tabs>
  )

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
        {/* Header: repo selector + git actions sit above the sidebar/content split */}
        <header className="shrink-0 border-b border-border">
          <div className="flex items-center gap-2 px-3 py-2 sm:px-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 md:hidden"
              title="Open file sidebar"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={16} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden h-8 w-8 md:inline-flex"
              title="Toggle sidebar (Ctrl+B)"
              onClick={toggleSidebar}
            >
              <PanelLeft size={16} />
            </Button>
            <GitBranch size={18} className="text-muted-foreground" />
            <h1 className="text-sm font-semibold sm:text-lg">Git Review</h1>
            {branch && <Badge variant="secondary" className="text-xs">{branch}</Badge>}
            <div className="flex-1" />
            {actionResult && (
              <span
                className={`max-w-32 truncate text-xs sm:max-w-72 ${actionResult.ok ? "text-green-600 dark:text-green-400" : "text-destructive"}`}
                title={actionResult.message}
              >
                {actionResult.message}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={() => toggleTheme()} className="gap-2">
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
              <span className="hidden sm:inline">{isDark ? "Light" : "Dark"}</span>
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setCreateFileOpen(true)}
                >
                  <FilePlus size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">New File</TooltipContent>
            </Tooltip>
          </div>

          {/* Repo selector + git actions */}
          <form
            onSubmit={e => { e.preventDefault(); loadStatus() }}
            className="grid grid-cols-4 gap-2 border-t border-border px-3 py-2 sm:flex sm:flex-wrap sm:items-center sm:px-4"
          >
            <div className="relative col-span-3 min-w-40 flex-1 sm:max-w-xs">
              <Folder size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <select
                value={repoPath}
                onChange={e => {
                  const nextRepo = e.target.value
                  if (nextRepo === repoPath) return
                  // If the buffer has dirty tabs, confirm before discarding.
                  const hasDirty = buffer.some(b => b.dirty)
                  if (hasDirty && !window.confirm("Discard unsaved changes in open tabs?")) {
                    // Restore the select's visual value by re-rendering — the
                    // browser already painted the new value, but we'll keep
                    // repoPath at the old one and bail.
                    return
                  }
                  // Persist the *outgoing* repo's tabs first so the next
                  // visit to that repo restores the same list.
                  writePersistedBuffer(repoPath, buffer, activeId)
                  setRepoPath(nextRepo)
                  setFiles([])
                  setAllFiles([])
                  setExpandedDirs(new Set())
                  // Restore this repo's previously open tabs (if any). The
                  // buffer stays empty until loadStatus fires; the restore
                  // runs once on mount of the new repo below.
                  const restored = readPersistedBuffer(nextRepo)
                  if (restored) {
                    const seeded: BufferEntry[] = restored.tabs.map(t => ({
                      id: makeTabId(nextRepo, t.file, t.staged, t.fromAll),
                      file: t.file,
                      staged: t.staged,
                      fromAll: t.fromAll,
                      diff: "",
                      diffLoading: false,
                      raw: "",
                      rawError: "",
                      md: "",
                      mdRender: false,
                      viewMode: "split",
                      editMode: false,
                      editContent: "",
                      dirty: false,
                    }))
                    setBuffer(seeded)
                    setActiveId(
                      restored.activeId && seeded.some(b => b.id === restored.activeId)
                        ? restored.activeId
                        : seeded[0]?.id ?? null
                    )
                  } else {
                    setBuffer([])
                    setActiveId(null)
                  }
                  persistedRepoRef.current = nextRepo
                  // Update the canonical URL so reloads keep the same project.
                  const firstProject = projects.projects[0]
                  const newUrl = firstProject && firstProject.dir === nextRepo
                    ? window.location.pathname
                    : `${window.location.pathname}?project=${encodeURIComponent(projects.projects.find(p => p.dir === nextRepo)?.name ?? "")}`
                  window.history.replaceState(null, "", newUrl)
                  loadStatus(nextRepo)
                }}
                title={repoPath}
                className="h-9 w-full cursor-pointer rounded-md border border-input bg-background pl-9 pr-3 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {projects.projects.map(p => (
                  <option key={p.dir} value={p.dir}>{p.name}</option>
                ))}
              </select>
            </div>
            <Button type="submit" size="sm" disabled={loading} className="col-span-1 gap-1.5">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <input
              value={commitMsg}
              onChange={e => setCommitMsg(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && commitMsg.trim() && !busyAction) {
                  runAction("commit", { message: commitMsg })
                }
              }}
              placeholder="Commit message…"
              className="col-span-2 h-9 min-w-40 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button
              size="sm"
              className="col-span-1 gap-1.5"
              disabled={!!busyAction || !commitMsg.trim()}
              onClick={() => runAction("commit", { message: commitMsg })}
            >
              {busyAction === "commit" ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
              Commit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="col-span-1 gap-1.5"
              disabled={!!busyAction}
              onClick={() => runAction("push")}
            >
              {busyAction === "push" ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
              Push
            </Button>
          </form>

          {error && (
            <div className="border-t border-border bg-destructive/10 px-3 py-1.5 text-sm text-destructive sm:px-4" title={error}>
              <span className="line-clamp-1">{error}</span>
            </div>
          )}
        </header>

        {/* Sidebar + content split */}
        <div className="flex min-h-0 flex-1">
          {sidebarOpen && (
            <>
              {/* Desktop sidebar (VS Code-style) */}
              <aside
                className="hidden shrink-0 flex-col border-r border-border bg-card md:flex"
                style={{ width: sidebarWidth }}
              >
                <div className="min-h-0 flex-1" data-sidebar-body>
                  <ScrollArea className="h-full">
                    {/* eslint-disable-next-line react-hooks/refs -- sidebarContent is a render-time helper that returns JSX; the ref usage it transitively contains is inside event handlers (loadDiff/runAction/refreshTab), not during render */}
                    <div className="space-y-1 py-2 pr-2">{sidebarContent(() => {})}</div>
                  </ScrollArea>
                </div>
              </aside>
              {/* Drag handle: resize sidebar (double-click resets width) */}
              <div
                onPointerDown={startResize}
                onDoubleClick={() => setSidebarWidth(SIDEBAR_DEFAULT_WIDTH)}
                title="Drag to resize · double-click to reset"
                className={`hidden w-1 shrink-0 cursor-col-resize bg-border transition-colors hover:bg-ring md:block ${isResizing ? "bg-ring" : ""}`}
              />
            </>
          )}

          {/* Diff viewer: fills the remaining space, no max-width constraint */}
          <main className="flex min-w-0 flex-1 flex-col overflow-hidden p-2 sm:p-4">
            {/* Tab strip — one entry per open file. Click a tab to activate +
                refetch; × to close; ↻ to refresh without changing focus. */}
            {buffer.length > 0 && (
              <div
                role="tablist"
                aria-label="Open files"
                className="diff-tabs mb-1 flex min-h-8 flex-nowrap items-center gap-1 overflow-x-auto rounded-md border border-border bg-card px-1 py-1"
              >
                {buffer.map(entry => {
                  const isActive = entry.id === activeId
                  const basename = entry.file.split("/").pop() ?? entry.file
                  const status = files.find(f => f.path === entry.file && f.staged === entry.staged)?.status
                    ?? (entry.fromAll ? "untracked" : "modified")
                  return (
                    <div
                      key={entry.id}
                      role="tab"
                      aria-selected={isActive}
                      data-tab-id={entry.id}
                      className={`group flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-xs outline-none transition-colors ${isActive ? "border-primary/40 bg-primary/10 text-foreground" : "border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`}
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => setActiveId(entry.id)}
                            className="flex min-w-0 items-center gap-1.5 text-left"
                          >
                            <span className="shrink-0">{statusIcon(status)}</span>
                            <span className="max-w-40 truncate">{basename}</span>
                            {entry.dirty && <span className="size-1.5 shrink-0 rounded-full bg-amber-500" aria-label="Unsaved changes" />}
                            {entry.diffLoading && <RefreshCw size={11} className="shrink-0 animate-spin text-muted-foreground" />}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs">
                          <p className="text-xs">{entry.file}{entry.staged ? " (staged)" : ""}{entry.fromAll ? " (from All Files)" : ""}</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Refresh ${entry.file}`}
                            disabled={entry.diffLoading}
                            onClick={e => { e.stopPropagation(); refreshTab(entry) }}
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                          >
                            <RefreshCw size={11} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Refresh</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Close ${entry.file}`}
                            onClick={e => {
                              e.stopPropagation()
                              if (entry.dirty && !window.confirm("Discard unsaved changes?")) return
                              closeTab(entry.id)
                            }}
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
                          >
                            <X size={11} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Close tab</TooltipContent>
                      </Tooltip>
                    </div>
                  )
                })}
              </div>
            )}
            <Card ref={diffCardRef} className="diff-card flex min-h-0 flex-1 flex-col overflow-hidden">
              <CardHeader className="shrink-0 p-3 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="truncate text-sm">
                    {active ? active.file.split("/").pop() : "Select a file"}
                  </CardTitle>
                  {active && (
                    <div className="flex items-center gap-1">
                      {active.editMode && (
                        <Button
                          variant="default"
                          size="sm"
                          className="h-7 gap-1"
                          disabled={!active.dirty || isSaving}
                          onClick={saveFile}
                        >
                          {isSaving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                          Save
                        </Button>
                      )}
                      {!active.fromAll && !active.editMode && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={!!busyAction}
                              onClick={() => {
                                if (active.staged) {
                                  runAction("unstage", { files: [active.file] })
                                } else {
                                  runAction("add", { files: [active.file] })
                                }
                              }}
                            >
                              {busyAction === "add" || busyAction === "unstage" ? <RefreshCw size={13} className="animate-spin" /> : active.staged ? <Minus size={13} /> : <Plus size={13} />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">{active.staged ? "Unstage this file" : "Stage this file"}</TooltipContent>
                        </Tooltip>
                      )}
                      {isMarkdownFile(active.file) && !active.editMode && (
                        <Button
                          variant={active.mdRender ? "default" : "outline"}
                          size="icon"
                          className="h-7 w-7"
                          title="Render as Markdown"
                          onClick={() => {
                            if (!active.mdRender) loadMarkdown(active)
                            updateEntry(active.id, { mdRender: !active.mdRender })
                          }}
                        >
                          <Eye size={13} />
                        </Button>
                      )}
                      {canEdit(active.file) && !active.editMode && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              title="Edit file"
                              onClick={toggleEditMode}
                            >
                              <FilePen size={13} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">Edit file</TooltipContent>
                        </Tooltip>
                      )}
                      {active.fromAll && !active.editMode && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              title="Delete file"
                              onClick={() => openDeleteDialog(active.file)}
                            >
                              <Trash2 size={13} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">Delete file</TooltipContent>
                        </Tooltip>
                      )}
                      {active.editMode && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              title="Cancel editing"
                              onClick={toggleEditMode}
                            >
                              <Minus size={13} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">Cancel editing</TooltipContent>
                        </Tooltip>
                      )}
                      {!active.fromAll && !active.editMode && (
                        <>
                          <Button
                            variant={active.viewMode === "raw" ? "default" : "outline"}
                            size="icon"
                            className="h-7 w-7"
                            title="View raw file (syntax highlighted)"
                            onClick={() => {
                              const next = active.viewMode === "raw" ? "split" : "raw"
                              updateEntry(active.id, { viewMode: next })
                              if (next === "raw" && (!active.raw || active.rawError)) {
                                void fetchRaw(active)
                              }
                            }}
                          >
                            <FileCode size={13} />
                          </Button>
                          <Button variant={active.viewMode === "unified" ? "default" : "outline"} size="icon" className="h-7 w-7" onClick={() => updateEntry(active.id, { viewMode: "unified" })}>
                            <AlignJustify size={13} />
                          </Button>
                          <Button variant={active.viewMode === "split" ? "default" : "outline"} size="icon" className="h-7 w-7" onClick={() => updateEntry(active.id, { viewMode: "split" })}>
                            <Split size={13} />
                          </Button>
                        </>
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
                {active && (
                  <p className="mt-1 truncate text-xs text-muted-foreground">{active.file}</p>
                )}
              </CardHeader>
              <Separator />
              <CardContent className="diff-content min-h-0 flex-1 p-0">
                {active?.editMode ? (
                  <EditView
                    content={active.editContent}
                    file={active.file}
                    onChange={v => updateEntry(active.id, { editContent: v, dirty: v !== active.raw })}
                  />
                ) : (
                  <div className="diff-scroll h-full overflow-auto">
                    {!active ? (
                      <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                        <GitCommit size={24} />
                        <p className="text-sm mt-2">Select a file to view diff</p>
                      </div>
                    ) : active.diffLoading && !active.fromAll ? (
                      <div className="flex items-center justify-center h-32">
                        <RefreshCw size={20} className="animate-spin text-muted-foreground" />
                      </div>
                    ) : active.fromAll ? (
                      active.mdRender && isMarkdownFile(active.file) ? (
                        <MarkdownView content={active.md} />
                      ) : active.rawError ? (
                        <div className="p-4 text-sm text-destructive whitespace-pre-wrap break-words">{active.rawError}</div>
                      ) : active.raw ? (
                        <CodeView content={active.raw} file={active.file} fullPath={selectedFullPath} />
                      ) : (
                        <div className="flex items-center justify-center h-32">
                          <RefreshCw size={20} className="animate-spin text-muted-foreground" />
                        </div>
                      )
                    ) : active.mdRender && isMarkdownFile(active.file) ? (
                      <MarkdownView content={active.md} />
                    ) : active.viewMode === "raw" ? (
                      active.rawError ? (
                        <div className="p-4 text-sm text-destructive whitespace-pre-wrap break-words">{active.rawError}</div>
                      ) : active.raw ? (
                        <CodeView content={active.raw} file={active.file} fullPath={selectedFullPath} />
                      ) : (
                        <div className="flex items-center justify-center h-32">
                          <RefreshCw size={20} className="animate-spin text-muted-foreground" />
                        </div>
                      )
                    ) : active.diff ? (
                      <DiffView raw={active.diff} view={active.viewMode === "split" ? "split" : "unified"} fullPath={selectedFullPath} />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                        <GitCommit size={24} />
                        <p className="text-sm mt-2">No changes for this file</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </main>
        </div>

        {/* Mobile: sidebar opens as a Sheet overlay */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-80 gap-0 p-0 sm:max-w-xs">
            <SheetHeader className="border-b border-border py-3">
              <SheetTitle className="flex items-center gap-2 text-sm">
                <Folder size={14} className="text-muted-foreground" />
                Files
              </SheetTitle>
              <SheetDescription className="sr-only">Browse repository files</SheetDescription>
            </SheetHeader>
              <div className="min-h-0 flex-1" data-sidebar-body>
              <ScrollArea className="h-full">
                {/* eslint-disable-next-line react-hooks/refs -- sidebarContent is a render-time helper that returns JSX; the ref usage it transitively contains is inside event handlers (loadDiff/runAction/refreshTab), not during render */}
                <div className="space-y-1 py-2 pr-2">{sidebarContent(() => setMobileOpen(false))}</div>
              </ScrollArea>
            </div>
          </SheetContent>
        </Sheet>

        {/* Create File Dialog */}
        <Dialog open={createFileOpen} onOpenChange={setCreateFileOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New File</DialogTitle>
              <DialogDescription>
                Enter the file path relative to the repository root.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                placeholder="path/to/new-file.txt"
                value={createFileName}
                onChange={e => setCreateFileName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") handleCreateFile()
                }}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateFileOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateFile} disabled={!createFileName.trim() || busyAction === "create"}>
                {busyAction === "create" ? <RefreshCw size={14} className="animate-spin mr-2" /> : null}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete File Dialog */}
        <Dialog open={deleteFileOpen} onOpenChange={setDeleteFileOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Delete File</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete <code className="bg-muted px-1 rounded">{fileToDelete}</code>? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setDeleteFileOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteFile}
                disabled={busyAction === "delete"}
              >
                {busyAction === "delete" ? <RefreshCw size={14} className="animate-spin mr-2" /> : <Trash2 size={14} className="mr-2" />}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
