# Diff Tree v0.1.0

Review Git changes in BB with a searchable directory tree beside a unified or split diff.

- Browse all branch changes, uncommitted work, the last 1–100 commits, or one selected commit.
- Compare against BB's recorded creation branch or pick a branch manually.
- Expand unchanged lines above, below, and between hunks.
- Select lines with click, Shift-click, or drag, then add their diff fragment to the chat draft.
- Mention a file with the header button or Cmd/Ctrl+click in the tree.
- Recognize file types with Seti icons and keep review state across refreshes.

Requires BB 0.46.1+, Plugin SDK 0.6.49+, and Git on the workspace host for history. No external service or account is required.

Install the release with:

```sh
bb plugin install 'git:https://github.com/SergeyGavrilov/bb-diff-tree.git@^0.1.0'
```

See README for local installation and supported limits.
