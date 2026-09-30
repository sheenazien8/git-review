# PROJECT KNOWLEDGE BASE

**Generated:** 2026-02-19 (updated 2026-09-28 after the architecture refactor — see `docs/plan/20-refactor-architecture.md`)

## OVERVIEW
Project: **git-review**
A local multi-repo Git review tool: a single-page Next.js app that runs `git` (via `child_process.execFile`, never a shell) against a repository chosen from `projects.json`. Features: staged/untracked file lists, unified/split/raw diffs, full-file content view (with syntax highlighting and optional Markdown rendering), filesystem file browser, and staging/unstaging/commit/push actions. Deployable as a Dockerized installable PWA.

Stack: Next.js **16.3.4** (App Router, Turbopack) · React **19.2.8** · TypeScript **5** · Tailwind CSS **v4** (via `@tailwindcss/postcss`) · shadcn/ui (new-york style, Radix UI primitives) · lucide-react icons · Serwist **9** (PWA service worker) · react-markdown + remark-gfm + rehype-highlight + highlight.js (content rendering) · Vitest **5** · pnpm **11.8.0** · Docker (node:22-alpine, standalone output)

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## STRUCTURE
Layered: `app/` is routing only → `server/` (server-only git/fs logic) and `features/` (client UI by feature) → `lib/` (isomorphic, pure).
```
├── src/app/                    # ROUTING ONLY — keep thin
│   ├── layout.tsx              # Root layout: Geist fonts, PWA metadata, pre-hydration dark-mode script
│   ├── page.tsx                # Server component; just renders <GitReviewApp />
│   ├── login/page.tsx          # Login form
│   ├── manifest.ts             # MetadataRoute.Manifest → /manifest.webmanifest (only source — no public/ copy)
│   ├── sw.ts                   # Serwist service worker source
│   └── api/
│       ├── auth/{login,logout,me}/route.ts
│       └── git/{status,diff,content,all-files,action,worktrees}/route.ts
│                               # Each: parse params → resolveRepo() → one server/ call → JSON.
│                               #   Wrapped in withErrors() (HttpError → status, else 500 + git stderr).
├── src/proxy.ts                # Next 16 "proxy" (was middleware.ts): JWT session check, 401/redirect
├── src/server/                 # `import "server-only"` in every module
│   ├── config.ts               # projects.json (build-time import), defaultRepo(), findProject(),
│   │                           #   GIT_REVIEW_ALLOW_ANY_REPO, loadIgnorePatterns()
│   ├── repo.ts                 # resolveRepo() allowlist (403) + resolveInRepo() path-escape guard (400)
│   ├── http.ts                 # HttpError, withErrors(), readJson(), requireParam(), errorMessage()
│   ├── git/exec.ts             # git(repo, args, {okExitCodes}) via execFile; isUnbornHead, EMPTY_TREE
│   ├── git/status.ts           # getStatus(), isUntracked()
│   ├── git/diff.ts             # getDiff(repo, { file, oldPath, side })
│   ├── git/actions.ts          # `actions: Record<ActionName, handler>` — one fn per POST action
│   ├── git/worktree.ts         # list/add/remove worktrees, mainWorktreeOf() (reads .git file, no git)
│   ├── fs/files.ts             # read/write/create/remove repo files (all path-guarded)
│   └── fs/walk.ts              # All Files walker + ignore-pattern matching
├── src/lib/                    # isomorphic + pure (no "use client", no server-only)
│   ├── git/types.ts            # API contract shared by routes and client (GitFile, RepoEntry, ActionName…)
│   ├── git/parse-status.ts     # porcelain v1 parser (one entry per staged/unstaged side)
│   ├── git/parse-diff.ts       # unified diff → hunks
│   ├── git/parse-worktrees.ts  # `git worktree list --porcelain -z` parser
│   ├── api-client.ts           # `api.*` typed fetchers — the ONLY place that calls /api/git/*
│   ├── auth.ts                 # JWT sign/verify, cookies, credentials from env
│   └── utils.ts                # cn()
├── src/features/               # client UI, one folder per feature
│   ├── app/                    # git-review-app.tsx ("use client" boundary + orchestration),
│   │                           #   app-header.tsx, use-keyboard-shortcuts.ts
│   ├── buffer/                 # open tabs: buffer.ts (pure reducer + persistence), use-buffer.ts
│   │                           #   (fetching, in-flight guard), use-editing.ts, tab-bar.tsx
│   ├── changes/                # use-git-status.ts, use-git-actions.ts, dialogs.tsx
│   ├── sidebar/                # tree.ts (pure), use-sidebar.ts (+useExpandedDirs), file-tree.tsx,
│   │                           #   sidebar-content.tsx, sidebar-frame.tsx (desktop aside + mobile sheet)
│   ├── viewer/                 # viewer-panel.tsx (toolbar), file-viewer.tsx (view switch),
│   │                           #   diff/code/markdown/edit views, numbered-code.tsx, highlight-code.ts
│   ├── find/                   # find.ts (pure engine), use-find.ts, find-bar.tsx, highlight-segments.tsx
│   ├── files/                  # file-types.ts (binary/markdown/lang), status-display.tsx
│   ├── clipboard/              # use-copy-range.ts (click-twice path:line range copy)
│   ├── projects/projects.ts    # client copy of projects.json + ?project=&worktree= URL sync
│   ├── worktrees/              # worktrees.ts (pure: default path, labels), use-worktrees.ts,
│   │                           #   worktree-dialogs.tsx (add/remove)
│   └── theme/theme.ts          # useTheme() over the .dark class
├── src/components/ui/          # shadcn/ui (badge, button, card, dialog, input, scroll-area,
│                               #   separator, sheet, skeleton, tabs, tooltip)
├── src/**/*.test.ts, test/     # Vitest; test/git-repo.ts creates throwaway git repos
├── projects.json               # Project list (name + dir [+ ignore]) — gitignored; imported at build time
├── ignore.config.json          # Global ignore patterns for all-files browser (read at runtime)
├── Dockerfile / docker-compose.yml
└── public/                     # PWA icons (192/512/maskable/apple), generated sw.js, fonts/
```
*   `components.json`: shadcn/ui config — aliases `@/components`, `@/components/ui`, `@/lib/utils`, `@/hooks`.
*   `pnpm-workspace.yaml`: `allowBuilds` flags (`@swc/core` allowed; sharp/unrs-resolver blocked).
*   Docker: container mounts host dirs `/mnt/storage` and `/DATA` so it can act on real repos; runs as `node` (uid 1000, matching host user for write access) with `git safe.directory '*'`.

## COMMANDS
| Action                | Command                          |
|-----------------------|----------------------------------|
| Install               | `pnpm install`                   |
| Dev server            | `pnpm dev`                       |
| Build                 | `pnpm build`                     |
| Start (prod)          | `pnpm start`                      |
| Lint                  | `pnpm lint`                       |
| Test                  | `pnpm test` (`pnpm test:watch`)   |
| Docker build & run    | `docker compose up -d --build`   |

Docker serves the app on **host port 3456** → container 3000 (`docker-compose.yml`).

Vitest (`vitest.config.mts`, node env). Unit tests sit next to the code (`*.test.ts`); git/fs integration tests run against temp repos from `test/git-repo.ts`. `server-only` is aliased to a stub for tests. UI has no automated tests — smoke-test in `pnpm dev`.

## CODING STANDARDS
*   **Language**: TypeScript, `strict: true`, `noEmit`, `moduleResolution: bundler`, `jsx: react-jsx`. Path alias `@/*` → `./src/*`.
*   **Style**: Function components; state lives in feature hooks (`use-*.ts`), pure logic in hook-free modules so it can be unit-tested (e.g. `buffer.ts` reducer, `find.ts`, `tree.ts`). Server logic lives in `src/server/`, never in route handlers. Kebab-case file names. No semicolons, double quotes in config files, no-quotes style in src. Plain `function` declarations preferred over arrow consts for top-level helpers.
*   **Lint/format**: ESLint 9 flat config (`eslint.config.mjs`) with `eslint-config-next` core-web-vitals + TS presets. No Prettier config.
*   **Styling**: Tailwind v4 utility classes; dark mode is **token-driven**: theme tokens are CSS variables in `globals.css` mapped via `@theme inline` (`bg-card`, `text-foreground`, `border-border`, `bg-primary`, …) plus `dark:` variants (`@custom-variant dark` on the `.dark` class) for semantic one-off colors (diff add/remove backgrounds). **Never** hardcode theme colors (`bg-white`, `bg-neutral-900`, `hover:bg-neutral-100`) and never compose class names with template interpolation — Tailwind JIT only sees complete literals.
*   **shadcn/ui**: new-york style, RSC on, CSS-variables theming. Add components with the shadcn CLI; they land in `src/components/ui/`.
*   **API routes / git**: always go through `git()` in `server/git/exec.ts` (argument array, `--` before paths). Never use `exec` or build shell strings. Every route resolves the repo with `resolveRepo()` and every repo-relative path with `resolveInRepo()`. Throw `HttpError` for 4xx; let `withErrors` handle the rest. Add request/response types to `lib/git/types.ts` and a wrapper to `lib/api-client.ts`.
*   **Boundaries**: `features/` must never import `server/` (enforced by `server-only`). `lib/` stays pure. Only `features/app/git-review-app.tsx` carries `"use client"`.

## WHERE TO LOOK
*   **Source**: `src/server/` (backend), `src/features/` (UI), `src/lib/` (shared contract + parsers), `src/app/` (routes)
*   **Feature plans**: `docs/plan/NN-*.md` (numbered by creation order; context + goals for each feature)
*   **Docs**: `README.md` (stock create-next-app); Next.js guides in `node_modules/next/dist/docs/` (see the agent-rules block above)
*   **Other context files**: `CLAUDE.md` → references `@AGENTS.md` (this file)

## NOTES
*   **This is Next.js 16** — do NOT assume training-data knowledge of its APIs; consult `node_modules/next/dist/docs/` first (see block above).
*   **Repo allowlist**: `resolveRepo()` (async) only accepts dirs listed in `projects.json` **or linked worktrees of them** (403 otherwise). A worktree is recognised by reading its `.git` file (never by running git inside an unlisted dir) and confirmed with `git worktree list` in the project dir. Set `GIT_REVIEW_ALLOW_ANY_REPO=1` to lift it. A missing `repo` param falls back to the **first** project — same default as the client. There is no hardcoded repo path anymore.
*   **projects.json** is imported **at build time** by both `server/config.ts` and `features/projects/projects.ts` — editing it (including per-project `ignore`) needs a rebuild/restart. It is gitignored but must exist to build (Docker copies it via `COPY . .`).
*   **Untracked-diff quirk** (`server/git/diff.ts`): untracked files are diffed via `git diff --no-index /dev/null <file>`, which exits 1 on success — passed as `okExitCodes: [1]` to `git()`. Staged diffs and unstage fall back to the empty tree / `git rm --cached` when HEAD is unborn (`isUnbornHead()`).
*   **all-files browser** (`server/fs/walk.ts`): walks with `readdir`/`stat`, ignore patterns = global `ignore.config.json` (hardcoded fallback if missing/malformed) ∪ per-project `"ignore"`. Pattern syntax: bare name = any path segment; `*.ext` = suffix; `name*` = prefix; `a/b` = path prefix.
*   **Worktrees**: the app tracks `projectDir` (selector, from projects.json) and `repoPath` (the worktree every API call targets). `addWorktree`/`removeWorktree` are actions; worktree commands run from the main worktree. New worktree paths must be absolute and inside the main worktree's parent dir (UI default `<parent>/<repo>-<branch-slug>`), unless `GIT_REVIEW_ALLOW_ANY_REPO=1`.
*   **Tabs** (`features/buffer/`): persisted per repo under `git-review-tabs-<base64 repo>` (list + active id only; content is re-fetched). `useBuffer` keeps a synchronous in-flight `Set` ref so rapid clicks don't queue duplicate fetches, and re-fetches the active tab once status has loaded (rename hints need `files`).
*   **Dark mode**: persisted in `localStorage` under key `git-review-dark`. The `.dark` class is applied **pre-hydration** by an inline script in `layout.tsx` (localStorage → falls back to `prefers-color-scheme`), so there is no theme flash. `useTheme()` (`features/theme/theme.ts`) reads it via `useSyncExternalStore` and writes `localStorage` + toggles the class. Keep the key in sync with `layout.tsx`.
*   **React compiler lint** (`react-hooks/refs`): don't return a ref inside an object you then read during render — destructure it (see `useFullscreen` in `viewer-panel.tsx`).
*   **PWA**: Serwist wraps `next.config.ts` (`withSerwist` from `@serwist/turbopack`); worker source is `src/app/sw.ts` (precache + `defaultCache` runtime caching, `skipWaiting`/`clientsClaim`); compiled to `public/sw.js`. `manifest.webmanifest` is served via `src/app/manifest.ts`. `output: "standalone"` is required for the slim Docker image.
*   The `LayoutProps<"/">` type in `layout.tsx` is a Next.js 16 global type (not a local import).
