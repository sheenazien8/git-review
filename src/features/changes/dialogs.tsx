import { useState } from "react"
import { RefreshCw, RotateCcw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { ActionName } from "@/lib/git/types"
import { isDiscardAction } from "./use-git-actions"

// Open flag + the value the dialog is about. The value is kept after closing
// so the content doesn't blank out during the close animation.
export function useDialog<T>() {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState<T | null>(null)
  const show = (v: T) => {
    setValue(v)
    setOpen(true)
  }
  return { open, setOpen, value, show }
}

export type DiscardKind = "discard" | "discardAll" | "discardStaged"

export interface DiscardRequest {
  action: DiscardKind
  files?: string[]
}

function discardCopy({ action, files }: DiscardRequest) {
  const s = files && files.length > 1 ? "s" : ""
  switch (action) {
    case "discardAll":
      return {
        title: "Discard all changes",
        description: "This will revert all modified tracked files and remove all untracked files and directories. This action cannot be undone.",
      }
    case "discardStaged":
      return {
        title: "Discard staged changes",
        description: `Are you sure you want to unstage and revert the selected file${s}? This action cannot be undone.`,
      }
    case "discard":
      return {
        title: "Discard changes",
        description: `Are you sure you want to discard changes to the selected file${s}? This action cannot be undone.`,
      }
  }
}

function Spinner() {
  return <RefreshCw size={14} className="animate-spin mr-2" />
}

export function CreateFileDialog({ open, onOpenChange, busy, onCreate }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  busy: boolean
  onCreate: (path: string) => Promise<void>
}) {
  const [name, setName] = useState("")
  const submit = async () => {
    if (!name.trim()) return
    onOpenChange(false)
    await onCreate(name.trim())
    setName("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New File</DialogTitle>
          <DialogDescription>Enter the file path relative to the repository root.</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Input
            placeholder="path/to/new-file.txt"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") submit()
            }}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!name.trim() || busy}>
            {busy ? <Spinner /> : null}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteFileDialog({ open, onOpenChange, file, busy, onConfirm }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  file: string | null
  busy: boolean
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Delete File</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <code className="bg-muted px-1 rounded">{file}</code>? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy ? <Spinner /> : <Trash2 size={14} className="mr-2" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DiscardDialog({ open, onOpenChange, request, busyAction, onConfirm }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  request: DiscardRequest | null
  busyAction: ActionName | null
  onConfirm: () => void
}) {
  const copy = request ? discardCopy(request) : null
  const busy = isDiscardAction(busyAction)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{copy?.title}</DialogTitle>
          <DialogDescription>{copy?.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy ? <Spinner /> : <RotateCcw size={14} className="mr-2" />}
            Discard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
