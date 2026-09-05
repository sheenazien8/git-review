# PROJECT KNOWLEDGE BASE

**Generated:** 2026-02-19 (updated)

## OVERVIEW
Project: **git-review**
A local multi-repo Git review tool: a single-page Next.js app that shells out to `git` (via `child_process`) against a selectable repository path. Features: staged/untracked file lists, unified/split/raw diffs, full-file content view (with syntax highlighting and optional Markdown rendering), filesystem file browser, and staging/unstaging/commit/push actions. Deployable as a Dockerized installable PWA.

Stack: Next.js **16.3.4** (App Router, Turbopack) · React **19.2.8** · TypeScript **5** · Tailwind CSS **v4** (via `@tailwindcss/postcss`) · shadcn/ui (new-york style, Radix UI primitives) · lucide-react icons · Serwist **9** (PWA service worker) · react-markdown + remark-gfm + rehype-highlight + highlight.js (content rendering) · pnpm **11.8.0** · Docker (node:22-alpine, standalone output)

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## STRUCTURE
```
├── src/app/
│   ├── layout.tsx              # Root layout: Geist fonts, PWA metadata, pre-hydration
│   │                           #   dark-mode script, .dark class host
│   ├── page.tsx                # Single ~1000-line "use client" page — entire UI
│   │                           #   (theme, file lists, DiffView/CodeView/MarkdownView,
│   │                           #   staging actions, fullscreen, copy-to-clipboard)
│   ├── globals.css             # Tailwind v4 import, @custom-variant dark, CSS variables
│   ├── manifest.ts             # MetadataRoute.Manifest → /manifest.webmanifest
│   ├── sw.ts                   # Serwist service worker source (precache + defaultCache)
│   └── api/git/
│       ├── status/route.ts     # GET: git status --porcelain -uall + branch → JSON
│       ├── diff/route.ts       # GET: staged/unstaged/untracked diff for one file → JSON
│       ├── content/route.ts    # GET: read a file (path-guarded, fs/promises) → JSON
│       ├── all-files/route.ts  # GET: walk the repo filesystem w/ ignore patterns → JSON
│       └── action/route.ts     # POST: add / addAll / unstage / unstageAll / commit / push
├── src/components/ui/          # shadcn/ui components (button, card, badge, tabs,
│                               #   scroll-area, separator, tooltip)
├── src/lib/utils.ts            # cn() + parseGitStatus() + parseDiff()
├── projects.json               # Project list (name + dir) — imported directly by page.tsx
├── ignore.config.json          # Global ignore patterns for all-files browser
├── Dockerfile / docker-compose.yml
└── public/                     # PWA icons (192/512/maskable/apple), manifest.webmanifest,
                                #   generated sw.js, stock create-next-app SVGs
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
| Docker build & run    | `docker compose up -d --build`   |

Docker serves the app on **host port 3456** → container 3000 (`docker-compose.yml`).

No test framework is configured.

## CODING STANDARDS
*   **Language**: TypeScript, `strict: true`, `noEmit`, `moduleResolution: bundler`, `jsx: react-jsx`. Path alias `@/*` → `./src/*`.
*   **Style**: Function components; hooks (`useState`/`useCallback`/`useEffect`/`useRef`/`useSyncExternalStore`) in the page; server code in API route handlers (`export async function GET/POST`). No semicolons, double quotes in config files, no-quotes style in src. Plain `function` declarations preferred over arrow consts for top-level helpers.
*   **Lint/format**: ESLint 9 flat config (`eslint.config.mjs`) with `eslint-config-next` core-web-vitals + TS presets. No Prettier config.
*   **Styling**: Tailwind v4 utility classes; dark mode is **token-driven**: theme tokens are CSS variables in `globals.css` mapped via `@theme inline` (`bg-card`, `text-foreground`, `border-border`, `bg-primary`, …) plus `dark:` variants (`@custom-variant dark` on the `.dark` class) for semantic one-off colors (diff add/remove backgrounds). **Never** hardcode theme colors (`bg-white`, `bg-neutral-900`, `hover:bg-neutral-100`) and never compose class names with template interpolation — Tailwind JIT only sees complete literals.
*   **shadcn/ui**: new-york style, RSC on, CSS-variables theming. Add components with the shadcn CLI; they land in `src/components/ui/`.
*   **API routes**: prefer `execFile`/`execFileAsync` (no shell) over `exec` for git commands — `action/route.ts` is the reference implementation (args passed as array, `--` separator, `maxBuffer: 10MB`). `status`/`diff` routes still use `exec` with quoted interpolation.

## WHERE TO LOOK
*   **Source**: `src/app/` (page + API routes), `src/components/ui/`, `src/lib/utils.ts`
*   **Feature plans**: `todos/*.md` (context + goals for each implemented feature)
*   **Docs**: `README.md` (stock create-next-app); Next.js guides in `node_modules/next/dist/docs/` (see the agent-rules block above)
*   **Other context files**: `CLAUDE.md` → references `@AGENTS.md` (this file)

## NOTES
*   **This is Next.js 16** — do NOT assume training-data knowledge of its APIs; consult `node_modules/next/dist/docs/` first (see block above).
*   **Git exec patterns**: `action/route.ts` uses `execFile` (no shell injection). `status`/`diff` routes use `exec` with the `file` param interpolated into a quoted shell string — shell-injection-prone, and the `repo` path is unrestricted everywhere. Fine for a trusted local tool; harden before exposing beyond localhost/Docker.
*   **Untracked-diff quirk** (`diff/route.ts`): untracked files are diffed via `git diff --no-index /dev/null "<file>"`, which exits 1 on success (differences exist) — the non-zero exit is caught, not an error. Unstage uses `git reset --` normally, but falls back to `git rm --cached` when HEAD is unborn (fresh repo with no commits) — see `isUnbornHead()`.
*   **DEFAULT_REPO fallback** (`/mnt/storage/Documents/Code/antikode/yamaha-golang-api`) is hardcoded in **all five** API routes: `status`, `diff`, `content`, `all-files`, and `action` (named `DEFAULT_REPO` in the latter two, inline string in the others). The page itself defaults to the first entry of `projects.json` instead. Keep these in sync if the primary project changes.
*   `page.tsx` imports `projects.json` **at build time** (`import projects from "../../projects.json"`) — editing that file requires a rebuild/reload to appear in the project selector.
*   **all-files browser** (`all-files/route.ts`): walks the repo with `readdir`/`stat`, filtering by ignore patterns = global `ignore.config.json` (hardcoded fallback list if missing/malformed) ∪ per-project `"ignore"` array from the matching `projects.json` entry. Per-project entries only add patterns, never remove global ones. `content/route.ts` resolves paths and rejects anything escaping the repo root (`startsWith(repoRoot + path.sep)`).
*   `parseDiff` logic exists in both `src/lib/utils.ts` and (inline, duplicated) in `src/app/page.tsx`. `src/lib/utils.ts` is the canonical copy; dedupe toward it if you touch either.
*   **Dark mode**: persisted in `localStorage` under key `git-review-dark`. The `.dark` class is applied **pre-hydration** by an inline script in `layout.tsx` (localStorage → falls back to `prefers-color-scheme`), so there is no theme flash. `page.tsx` reads the theme via `useSyncExternalStore` (`isThemeDark`/`isThemeDarkServer`) — this replaced the older `mounted`-flag pattern — and writes `localStorage` + toggles the class on change.
*   **PWA**: Serwist wraps `next.config.ts` (`withSerwist` from `@serwist/turbopack`); worker source is `src/app/sw.ts` (precache + `defaultCache` runtime caching, `skipWaiting`/`clientsClaim`); compiled to `public/sw.js`. `manifest.webmanifest` is served via `src/app/manifest.ts`. `output: "standalone"` is required for the slim Docker image.
*   The `LayoutProps<"/">` type in `layout.tsx` is a Next.js 16 global type (not a local import).
