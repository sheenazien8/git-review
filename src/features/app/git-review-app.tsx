"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { BufferEntry } from "@/features/buffer/buffer"
import { TabBar } from "@/features/buffer/tab-bar"
import { useBuffer } from "@/features/buffer/use-buffer"
import { useEditing } from "@/features/buffer/use-editing"
import { CreateFileDialog, DeleteFileDialog, DiscardDialog, type DiscardRequest, useDialog } from "@/features/changes/dialogs"
import { isDiscardAction, useGitActions } from "@/features/changes/use-git-actions"
import { useGitStatus } from "@/features/changes/use-git-status"
import { focusFindInput } from "@/features/find/highlight-segments"
import { useFind } from "@/features/find/use-find"
import { defaultRepo, repoFromUrl, syncRepoToUrl } from "@/features/projects/projects"
import { SidebarContent } from "@/features/sidebar/sidebar-content"
import { SidebarFrame } from "@/features/sidebar/sidebar-frame"
import { useExpandedDirs, useSidebar } from "@/features/sidebar/use-sidebar"
import { useTheme } from "@/features/theme/theme"
import { ViewerPanel, type ViewerHandlers } from "@/features/viewer/viewer-panel"
import type { ActionName, ActionPayload } from "@/lib/git/types"
import { AppHeader } from "./app-header"
import { useKeyboardShortcuts } from "./use-keyboard-shortcuts"

export function GitReviewApp() {
  const { isDark, toggleTheme } = useTheme()
  // Seed with the first project so the client always knows the active repo,
  // keeping the copy path:line action's full path honest from first load.
  const [repoPath, setRepoPath] = useState(defaultRepo)
  const status = useGitStatus(repoPath)
  const buffer = useBuffer(repoPath, status.loading)
  const { active } = buffer
  const sidebar = useSidebar()
  const dirs = useExpandedDirs()
  const find = useFind(active, buffer.update)
  const [fileSearch, setFileSearch] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const deleteDialog = useDialog<string>()
  const discardDialog = useDialog<DiscardRequest>()

  // --- Opening files --------------------------------------------------------

  // From the All Files tree: files with uncommitted changes open their diff so
  // the view matches the Changes/Staged sections; others open raw content.
  const openFromTree = useCallback((file: string) => {
    dirs.expandAncestors(file)
    const matched = status.files.find(f => f.path === file)
    buffer.open(matched
      ? { file, staged: matched.staged, fromAll: false, oldPath: matched.oldPath }
      : { file, staged: false, fromAll: true })
  }, [status.files, buffer, dirs])

  // From the Changes/Staged trees.
  const openChange = useCallback((file: string, staged: boolean) => {
    dirs.expandAncestors(file)
    const matched = status.files.find(f => f.path === file && f.staged === staged)
    buffer.open({ file, staged, fromAll: false, oldPath: matched?.oldPath })
  }, [status.files, buffer, dirs])

  // --- Git actions ----------------------------------------------------------

  // Reconciles the open tabs with the repo after a successful action.
  const afterAction = useCallback(async (action: ActionName, payload?: ActionPayload) => {
    const fresh = await status.loadStatus()
    const discard = isDiscardAction(action)
    const touchesActive = !!active && (payload?.files?.includes(active.file) ?? false)
    if (fresh && active && discard) {
      const gone = !fresh.some(f => f.path === active.file)
      if (action === "discardAll" || touchesActive || gone) buffer.close(active.id)
    }
    // Staging/unstaging the active file flips which side of it we're looking
    // at — keep the tab and update its staged flag in place.
    if (fresh && active && !discard && (action === "addAll" || action === "unstageAll" || touchesActive)) {
      const staged = fresh.some(f => f.path === active.file && f.staged)
      const oldPath = fresh.find(f => f.path === active.file && f.staged === staged)?.oldPath
      buffer.update(active.id, { staged, oldPath })
      void buffer.fetchEntry({ ...active, staged, oldPath })
    }
    if (action === "create" || action === "delete" || discard) {
      void status.loadAllFiles()
      if (action === "create" && payload?.path) openFromTree(payload.path)
    }
  }, [status, active, buffer, openFromTree])

  const { busyAction, actionResult, setActionResult, runAction } = useGitActions(repoPath, afterAction)
  const editing = useEditing({ repoPath, buffer, files: status.files, loadStatus: status.loadStatus, setActionResult })

  const requestDiscard = (files: string[], staged: boolean) =>
    discardDialog.show({ action: staged ? "discardStaged" : "discard", files })

  const confirmDiscard = async () => {
    const request = discardDialog.value
    if (!request) return
    discardDialog.setOpen(false)
    await runAction(request.action, request.files ? { files: request.files } : undefined)
  }

  const confirmDelete = async () => {
    const file = deleteDialog.value
    if (!file) return
    deleteDialog.setOpen(false)
    const activeId = active?.file === file ? active.id : null
    await runAction("delete", { files: [file] })
    if (activeId) buffer.close(activeId)
  }

  // --- Tabs, find, repo switching ------------------------------------------

  const requestClose = useCallback((entry: BufferEntry) => {
    if (entry.dirty && !window.confirm("Discard unsaved changes?")) return
    buffer.close(entry.id)
  }, [buffer])

  const openFind = useCallback(() => {
    find.open()
    focusFindInput()
  }, [find])

  const switchRepo = (next: string) => {
    if (next === repoPath) return
    if (buffer.entries.some(b => b.dirty) && !window.confirm("Discard unsaved changes in open tabs?")) return
    setRepoPath(next)
    status.clear()
    dirs.reset()
    buffer.restore(next)
    syncRepoToUrl(next)
    void status.loadStatus(next)
  }

  // First load: apply ?project=<name>, restore that repo's tabs, load status.
  const didInitialLoadRef = useRef(false)
  useEffect(() => {
    if (didInitialLoadRef.current) return
    didInitialLoadRef.current = true
    const repo = repoFromUrl() ?? repoPath
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot URL → state hydration on mount
    if (repo !== repoPath) setRepoPath(repo)
    buffer.restore(repo)
    void status.loadStatus(repo)
  }, [repoPath, buffer, status])

  useKeyboardShortcuts({
    active,
    entries: buffer.entries,
    activate: buffer.activate,
    requestClose,
    openFind,
    closeFind: find.close,
    toggleSidebar: sidebar.toggle,
    save: editing.saveFile,
  })

  const viewerHandlers: ViewerHandlers = {
    save: editing.saveFile,
    toggleEdit: editing.toggleEditMode,
    editChange: content => {
      if (active) buffer.update(active.id, { editContent: content, dirty: content !== active.raw })
    },
    discard: entry => requestDiscard([entry.file], entry.staged),
    toggleStaged: entry => runAction(entry.staged ? "unstage" : "add", { files: [entry.file] }),
    toggleMarkdown: entry => {
      if (!entry.mdRender) void buffer.loadMarkdown(entry)
      buffer.update(entry.id, { mdRender: !entry.mdRender })
    },
    setViewMode: (entry, mode) => {
      buffer.update(entry.id, { viewMode: mode })
      if (mode === "raw" && (!entry.raw || entry.rawError)) void buffer.fetchRaw(entry)
    },
    delete: deleteDialog.show,
    toggleFind: () => (active?.findOpen ? find.close() : openFind()),
  }

  const renderSidebar = (onNavigate: () => void) => (
    <SidebarContent
      files={status.files}
      allFiles={status.allFiles}
      loading={status.loading}
      search={fileSearch}
      onSearchChange={setFileSearch}
      onOpenChange={openChange}
      onOpenTreeFile={openFromTree}
      onNavigate={onNavigate}
      tree={{
        activeFile: active?.file,
        expanded: dirs.expanded,
        busy: !!busyAction,
        onToggleDir: dirs.toggle,
        onStage: (files, staged) => runAction(staged ? "unstage" : "add", { files }),
        onDiscard: requestDiscard,
        onDelete: deleteDialog.show,
      }}
    />
  )

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
        <AppHeader
          branch={status.branch}
          error={status.error}
          loading={status.loading}
          actionResult={actionResult}
          busyAction={busyAction}
          isDark={isDark}
          repoPath={repoPath}
          onToggleTheme={toggleTheme}
          onToggleSidebar={sidebar.toggle}
          onOpenMobileSidebar={() => sidebar.setMobileOpen(true)}
          onNewFile={() => setCreateOpen(true)}
          onDiscardAll={() => discardDialog.show({ action: "discardAll" })}
          onRepoChange={switchRepo}
          onRefresh={() => void status.loadStatus()}
          onCommit={message => runAction("commit", { message })}
          onPush={() => void runAction("push")}
        />

        <div className="flex min-h-0 flex-1">
          <SidebarFrame sidebar={sidebar} render={renderSidebar} />
          <main className="flex min-w-0 flex-1 flex-col overflow-hidden p-2 sm:p-4">
            <TabBar
              entries={buffer.entries}
              activeId={buffer.activeId}
              files={status.files}
              onActivate={buffer.activate}
              onRefresh={buffer.refresh}
              onClose={requestClose}
            />
            <ViewerPanel
              active={active}
              fullPath={active ? (repoPath ? `${repoPath}/${active.file}` : active.file) : ""}
              busyAction={busyAction}
              isSaving={editing.isSaving}
              canEdit={!!active && editing.canEdit(active.file)}
              find={find}
              on={viewerHandlers}
            />
          </main>
        </div>

        <CreateFileDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          busy={busyAction === "create"}
          onCreate={async path => { await runAction("create", { path }) }}
        />
        <DeleteFileDialog
          open={deleteDialog.open}
          onOpenChange={deleteDialog.setOpen}
          file={deleteDialog.value}
          busy={busyAction === "delete"}
          onConfirm={confirmDelete}
        />
        <DiscardDialog
          open={discardDialog.open}
          onOpenChange={discardDialog.setOpen}
          request={discardDialog.value}
          busyAction={busyAction}
          onConfirm={confirmDiscard}
        />
      </div>
    </TooltipProvider>
  )
}
