# Diff Tree v0.1.2

Browse the full worktree and read unchanged files beside your changes.

- Toggle **Worktree** to browse current files, including unchanged files. The button shows the active **Diff** or **Full tree** mode.
- Read syntax-highlighted working-copy source with line numbers. Changed files offer **Diff** and **File** previews; the preview switch stays in place when changing modes.
- Search paths on the workspace host, preserve separate folder expansion states, and add file mentions from either tree. Chat targets outside the comparison offer **View in worktree**.
- Worktree browsing honors Git ignore rules and BB's exclusions. Results are limited to 10,000 paths per query, with a partial-list notice and search for additional paths.
- Source previews load on selection with a 512 KiB limit and notices for binary, empty, oversized, or unreadable files. The native Open file action remains available.

File previews always show the live working copy, including when comparing historical commits. No new settings, dependencies, external services, or repository writes are added.

Requires BB 0.46.1+, Plugin SDK 0.6.49+, and Git on the workspace host for history.

Install the release with:

```sh
bb plugin install 'git:https://github.com/SergeyGavrilov/bb-diff-tree.git@^0.1.0'
```

Existing Plugin Hub installs track the compatible `^0.1.0` range. Check for plugin updates in BB to select this release.
