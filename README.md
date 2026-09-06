# Git Review

A local web UI for reviewing and acting on changes across your Git repositories. Pick a project, browse staged, unstaged, and untracked changes, read diffs (split/unified/raw), inspect full file contents with syntax highlighting or Markdown rendering, and stage, unstage, commit, or push — all from one page.

Built with [Next.js](https://nextjs.org) 16 (App Router), React 19, TypeScript, Tailwind CSS v4, and shadcn/ui. Ships as a Docker container and is installable as a PWA.

## Features

- **Project selector** — switch between repositories defined in `projects.json`
- **Change list** — staged / unstaged / untracked files with per-status badges
- **Diff viewer** — split, unified, or raw view, with click-to-copy on diff lines
- **File browser** — walk the whole repo tree (respecting ignore patterns) and open any tracked or untracked file
- **Content viewer** — syntax-highlighted source (highlight.js) or rendered Markdown (react-markdown + GFM)
- **Git actions** — stage/unstage single files or everything, commit, and push from the UI
- **Dark mode** — persisted, no theme flash (applied pre-hydration)
- **PWA** — installable on desktop and mobile; service worker caches the app shell (Serwist)

## Requirements

- Node.js 20+ and [pnpm](https://pnpm.io) 10+ (or Docker — see below)
- `git` available on the machine running the app (or in the container)

## Getting Started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

For a production build:

```bash
pnpm build
pnpm start
```

## Running with Docker

```bash
docker compose up -d --build
```

The app is served on **http://localhost:3456**. The compose file mounts `/mnt/storage` and `/DATA` from the host so the container can read and write (stage/commit) into your real repositories — adjust these mounts to wherever your code lives. The container runs as `node` (uid 1000) to match typical host file ownership, and marks all directories as git-safe.

## Configuration

- **`projects.json`** — the list of projects shown in the selector (`name` + `dir`). An optional `ignore` array on an entry adds extra ignore patterns for that project's file browser. Note: this file is bundled at build time, so rebuild after editing it.
- **`ignore.config.json`** — global ignore patterns for the file browser (mirrors typical `.gitignore` entries like `node_modules`, `dist`, `*.log`). Used as the fallback when an entry has no `ignore` array; per-project entries only add patterns, they never remove global ones.

## API Overview

All endpoints live under `/api/git` and take the target repository via the `repo` query param (or `repo` in the JSON body for POST):

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/git/status` | GET | Porcelain status + current branch |
| `/api/git/diff` | GET | Staged / unstaged / untracked diff for one file |
| `/api/git/content` | GET | Read a file's contents (path-guarded to the repo) |
| `/api/git/all-files` | GET | Repo filesystem walk with ignore filtering |
| `/api/git/action` | POST | `add`, `addAll`, `unstage`, `unstageAll`, `commit`, `push` |

## ⚠️ Local tool — do not expose publicly

The API executes `git` against **arbitrary repository paths supplied by the client**. There is no authentication and the repo path is unrestricted. This is intended for trusted local use (dev server or your own Docker host). Do not expose it to the internet without adding auth and path restrictions.

## Project Layout

```
src/app/            # Page, layout, API routes, service worker, manifest
src/components/ui/  # shadcn/ui components
src/lib/            # Shared utils (status/diff parsing)
todos/              # Per-feature planning docs
```

See `AGENTS.md` for a detailed knowledge base aimed at AI assistants working on this codebase.