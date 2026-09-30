import projectsFile from "../../../projects.json"

export interface Project {
  name: string
  dir: string
}

// Imported at build time — edits to projects.json need a rebuild.
export const projects: Project[] = projectsFile.projects

export const defaultRepo = projects[0]?.dir ?? ""

// Repo selected via ?project=<name> (exact, case-sensitive match), if any.
export function repoFromUrl(): string | null {
  try {
    const name = new URLSearchParams(window.location.search).get("project")
    return (name && projects.find(p => p.name === name)?.dir) || null
  } catch {
    return null
  }
}

// Keeps ?project= in the URL in sync so reloads keep the same project.
export function syncRepoToUrl(repo: string) {
  const url = repo === defaultRepo
    ? window.location.pathname
    : `${window.location.pathname}?project=${encodeURIComponent(projects.find(p => p.dir === repo)?.name ?? "")}`
  window.history.replaceState(null, "", url)
}
