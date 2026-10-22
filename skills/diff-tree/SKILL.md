---
name: diff-tree
description: Open or develop this plugin's directory-tree diff viewer in BB.
---

# Diff Tree

This plugin adds a `Diff Tree` thread side-panel tab and a GitBranch button in the thread header.
Open it with the header button or the right panel's `+` → `Diff Tree`.
It reads the current thread's environment through the public SDK and never modifies repository files. Its UI is in English.

- `All changes` compares branch and working-copy changes with the selected comparison branch. Before the first commit, both metadata and patches use the working-copy target.
- `Uncommitted` shows staged, unstaged, and untracked changes together.
- `Base` is BB's native searchable branch picker, with local and remote branches. Selection applies immediately. The reset button restores automatic selection; hover Auto/Manual for its source.
- `Recent commits` shows the combined last 1–100 first-parent commits with no working-copy changes. `Single commit` chooses from the latest 200 first-parent commits by SHA/subject/author.
- History and committed ranges run bounded, read-only Git commands on the environment's host through typed host RPC. The server derives the host and path from the environment; never accept arbitrary frontend workspace paths.
- Click a line number, Shift-click, or drag across line numbers to select rows in the diff. The floating `Add to chat` action appends the selected diff fragment (up to 500 visible rows), line coordinates, path, and revision to the existing draft without submitting. The manual From/To form has been removed.
- Interactive diffs use the host-shimmed public `@pierre/diffs/react` API because `experimental_Diff` does not forward selection callbacks. Keep its declarations aligned with the running BB version (currently 1.2.9), use `experimental_useCodeTheme`, and never import private BB viewer modules.
- Automatic comparison prefers BB's recorded creation branch (`baseBranch`, then the standard providers' named creation inputs), followed by the configured comparison and repository default. The hint identifies this source. Do not claim an unknown creation branch was detected from Git history.
- Search matches current and previous paths and temporarily expands matching directories.
- The refresh button reloads metadata and the selected patch. Returning to the app also refreshes it.
- Patches load on selection. Binary files, oversized files, and truncated results show notices.
- Unchanged lines expand upwards/downwards in 30-line steps or all at once, including file edges. Full text versions (up to 512 KiB each) must match the patch; stale or unavailable context leaves the original patch readable with a notice. Historical context uses the selected immutable revisions.
- The filename header button and Cmd/Ctrl+click on a tree file insert a public SDK workspace path mention into the existing draft without submitting. Plain click selects a file. File icons use the bundled `seti-file-icons` dependency (Seti UI, MIT); resolve the basename with filename rules before extension rules and keep unknown types' generic fallback. Never insert filenames into SVG markup.

Code lives in `src/app` (panel/components/hooks), `src/core` (tree/diff behavior), `src/host` (Git), `src/server` (RPC routing), and `src/shared` (contracts). Tests live in `tests`. Release documentation is in `docs/RELEASING.md`; run `npm run check:release` after building.

Development in the plugin directory: `npm ci --ignore-scripts`, `npm run typecheck`, `npm test`, `bb plugin build .`.
After edits to an installed path plugin, run `bb plugin reload diff-tree` (or use `bb plugin dev`).
This is a separate tab; it does not replace the built-in Changes panel.
