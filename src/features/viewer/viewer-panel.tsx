import type { ReactNode } from "react"
import {
  AlignJustify,
  Eye,
  FileCode,
  FilePen,
  Maximize,
  Minimize,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Split,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { BufferEntry, ViewMode } from "@/features/buffer/buffer"
import { basename, isMarkdownFile } from "@/features/files/file-types"
import { FindBar } from "@/features/find/find-bar"
import type { Find } from "@/features/find/use-find"
import type { ActionName } from "@/lib/git/types"
import { FileViewer } from "./file-viewer"
import { useFullscreen } from "./use-fullscreen"

export interface ViewerHandlers {
  save: () => void
  toggleEdit: () => void
  editChange: (content: string) => void
  discard: (entry: BufferEntry) => void
  toggleStaged: (entry: BufferEntry) => void
  toggleMarkdown: (entry: BufferEntry) => void
  setViewMode: (entry: BufferEntry, mode: ViewMode) => void
  delete: (file: string) => void
  toggleFind: () => void
}

function IconTip({ tip, children }: { tip: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="left">{tip}</TooltipContent>
    </Tooltip>
  )
}

// The main card: file title + toolbar, find bar, and the file view.
export function ViewerPanel({ active, fullPath, busyAction, isSaving, canEdit, find, on }: {
  active: BufferEntry | null
  fullPath: string
  busyAction: ActionName | null
  isSaving: boolean
  canEdit: boolean
  find: Find
  on: ViewerHandlers
}) {
  const { ref: cardRef, isFullscreen, toggle: toggleFullscreen } = useFullscreen<HTMLDivElement>()
  const editing = !!active?.editMode

  return (
    <Card ref={cardRef} className="diff-card flex min-h-0 flex-1 flex-col overflow-hidden">
      <CardHeader className="shrink-0 p-3 pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="truncate text-sm">{active ? basename(active.file) : "Select a file"}</CardTitle>
          {active && (
            <div className="flex items-center gap-1">
              {editing && (
                <Button variant="default" size="sm" className="h-7 gap-1" disabled={!active.dirty || isSaving} onClick={on.save}>
                  {isSaving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                  Save
                </Button>
              )}
              {!active.fromAll && !editing && (
                <>
                  <IconTip tip={active.staged ? "Discard staged changes" : "Discard changes"}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      disabled={!!busyAction}
                      onClick={() => on.discard(active)}
                    >
                      <RotateCcw size={13} />
                    </Button>
                  </IconTip>
                  <IconTip tip={active.staged ? "Unstage this file" : "Stage this file"}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!!busyAction} onClick={() => on.toggleStaged(active)}>
                      {busyAction === "add" || busyAction === "unstage"
                        ? <RefreshCw size={13} className="animate-spin" />
                        : active.staged ? <Minus size={13} /> : <Plus size={13} />}
                    </Button>
                  </IconTip>
                </>
              )}
              {isMarkdownFile(active.file) && !editing && (
                <Button
                  variant={active.mdRender ? "default" : "outline"}
                  size="icon"
                  className="h-7 w-7"
                  title="Render as Markdown"
                  onClick={() => on.toggleMarkdown(active)}
                >
                  <Eye size={13} />
                </Button>
              )}
              {canEdit && !editing && (
                <IconTip tip="Edit file">
                  <Button variant="outline" size="icon" className="h-7 w-7" title="Edit file" onClick={on.toggleEdit}>
                    <FilePen size={13} />
                  </Button>
                </IconTip>
              )}
              {active.fromAll && !editing && (
                <IconTip tip="Delete file">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    title="Delete file"
                    onClick={() => on.delete(active.file)}
                  >
                    <Trash2 size={13} />
                  </Button>
                </IconTip>
              )}
              {editing && (
                <IconTip tip="Cancel editing">
                  <Button variant="outline" size="icon" className="h-7 w-7" title="Cancel editing" onClick={on.toggleEdit}>
                    <Minus size={13} />
                  </Button>
                </IconTip>
              )}
              {!active.fromAll && !editing && (
                <>
                  <Button
                    variant={active.viewMode === "raw" ? "default" : "outline"}
                    size="icon"
                    className="h-7 w-7"
                    title="View raw file (syntax highlighted)"
                    onClick={() => on.setViewMode(active, active.viewMode === "raw" ? "split" : "raw")}
                  >
                    <FileCode size={13} />
                  </Button>
                  <Button
                    variant={active.viewMode === "unified" ? "default" : "outline"}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => on.setViewMode(active, "unified")}
                  >
                    <AlignJustify size={13} />
                  </Button>
                  <Button
                    variant={active.viewMode === "split" ? "default" : "outline"}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => on.setViewMode(active, "split")}
                  >
                    <Split size={13} />
                  </Button>
                </>
              )}
              {!editing && (
                <Button
                  variant={active.findOpen ? "default" : "outline"}
                  size="icon"
                  className="h-7 w-7"
                  title="Search in file (Ctrl/Cmd+F)"
                  onClick={on.toggleFind}
                >
                  <Search size={13} />
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
        {active?.findOpen && !editing && (
          <div className="mt-2">
            <FindBar
              query={active.findQuery}
              caseSensitive={active.findCaseSensitive}
              total={find.total}
              index={active.findMatchIndex}
              onQueryChange={find.setQuery}
              onCaseToggle={find.toggleCase}
              onPrev={find.prev}
              onNext={find.next}
              onClose={find.close}
            />
          </div>
        )}
        {active && <p className="mt-1 truncate text-xs text-muted-foreground">{active.file}</p>}
      </CardHeader>
      <Separator />
      <CardContent className="diff-content min-h-0 flex-1 p-0">
        <FileViewer entry={active} fullPath={fullPath} onEditChange={on.editChange} onMatchIndexClamp={find.setIndex} />
      </CardContent>
    </Card>
  )
}
