import { useState } from "react"
import { Archive, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

function Spinner() {
  return <RefreshCw size={14} className="animate-spin mr-2" />
}

// Switching with uncommitted changes: stash them first, or stay put.
export function SwitchBranchDialog({ open, onOpenChange, branch, busy, onConfirm }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  branch: string | null
  busy: boolean
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Uncommitted changes</DialogTitle>
          <DialogDescription>
            You have uncommitted changes. Stash them and switch to <code className="bg-muted px-1 rounded">{branch}</code>?
            They stay in the stash list until you apply or pop them.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onConfirm} disabled={busy}>
            {busy ? <Spinner /> : <Archive size={14} className="mr-2" />}
            Stash &amp; Switch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteBranchDialog({ open, onOpenChange, branch, busy, onConfirm }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  branch: string | null
  busy: boolean
  onConfirm: (force: boolean) => void
}) {
  const [force, setForce] = useState(false)
  const change = (next: boolean) => {
    if (!next) setForce(false)
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Delete Branch</DialogTitle>
          <DialogDescription>
            Delete the local branch <code className="bg-muted px-1 rounded">{branch}</code>? Remote branches are not touched.
          </DialogDescription>
        </DialogHeader>
        <label className="flex items-center gap-2 py-2 text-sm">
          <input
            type="checkbox"
            checked={force}
            onChange={e => setForce(e.target.checked)}
            className="h-4 w-4 accent-destructive"
          />
          Force — delete even if it isn&apos;t fully merged
        </label>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => change(false)}>Cancel</Button>
          <Button variant="destructive" onClick={() => { onConfirm(force); setForce(false) }} disabled={busy}>
            {busy ? <Spinner /> : <Trash2 size={14} className="mr-2" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
