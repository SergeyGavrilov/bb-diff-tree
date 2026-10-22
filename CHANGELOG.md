# Changelog

## Unreleased

- Optional chat file-link routing: BB default, an adjacent Diff Tree button, or opening ordinary clicks in Diff Tree.
- Support Open buttons in GenUI Changes/Commits file lists as well as Markdown links, preserving filename clicks for inline diff expansion.
- Keep a loaded diff visible during same-file background refreshes, update its patch and context together, and avoid duplicate initial loads when opening a chat target.
- Optional smooth diff transitions with a quiet loading skeleton, a short fade, and reduced-motion support. Disable in settings to restore loading text.
- Reuse the existing viewer for chat targets, select their tree rows, reveal parent folders, and show an explicit fallback for files without changes.
- BB-managed settings for file icons, initial diff layout, code font size, unchanged-line expansion step, and refresh on returning to the app.

These changes are unreleased development work and have not been published as a release.

## 0.1.0 — 2026-10-22

First public release of Diff Tree for BB.

### Added

- A thread panel and header shortcut for reviewing changes by directory.
- Search, expandable folders, aggregate line statistics, file status, and Seti file icons.
- All changes, uncommitted changes, recent commit ranges, and a single-commit picker.
- Automatic comparison from BB's recorded creation branch and a searchable manual branch picker.
- Unified and split diffs using BB's shared Pierre runtime and active code theme.
- Unchanged-line expansion above, below, and between hunks.
- Click, Shift-click, and drag line selection with an Add to chat action.
- File mentions through a header button or Cmd/Ctrl+click in the tree.
- Immutable historical snapshots and read-only Git operations on the workspace host.
- Responsive layout, keyboard tree navigation, and refresh that preserves review state.
