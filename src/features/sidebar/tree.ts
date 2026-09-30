export interface TreeNode {
  name: string
  path: string
  type: "dir" | "file"
  status: string
  children: TreeNode[]
}

export interface TreeEntry {
  path: string
  status: string
  type?: string
}

// Builds a nested tree from flat entries (files, and optionally dirs). Dir
// nodes carry the status given for them. Nodes are sorted dirs-first, then
// alphabetically, at every level.
export function buildTree(entries: TreeEntry[]): TreeNode[] {
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
      a.type === b.type ? a.name.localeCompare(b.name, undefined, { numeric: true }) : a.type === "dir" ? -1 : 1
    )
    for (const n of nodes) if (n.type === "dir") sortNodes(n.children)
  }
  sortNodes(root.children)
  return root.children
}

// Keeps files whose name/path contains the query, plus the dirs leading to
// them. A dir that matches by itself is kept without its children.
export function filterTreeNodes(nodes: TreeNode[], query: string): TreeNode[] {
  const q = query.trim().toLowerCase()
  if (!q) return nodes
  const matches = (node: TreeNode) => node.name.toLowerCase().includes(q) || node.path.toLowerCase().includes(q)
  const out: TreeNode[] = []
  for (const node of nodes) {
    if (node.type === "file") {
      if (matches(node)) out.push(node)
    } else {
      const filteredChildren = filterTreeNodes(node.children, query)
      if (filteredChildren.length > 0) {
        out.push({ ...node, children: filteredChildren })
      } else if (matches(node)) {
        out.push({ ...node, children: [] })
      }
    }
  }
  return out
}

export function collectFilePaths(node: TreeNode): string[] {
  if (node.type === "file") return [node.path]
  return node.children.flatMap(collectFilePaths)
}

// Every ancestor directory of a file path: "a/b/c.ts" -> ["a", "a/b"].
export function ancestorDirs(filePath: string): string[] {
  const segments = filePath.split("/")
  return segments.slice(1).map((_, i) => segments.slice(0, i + 1).join("/"))
}
