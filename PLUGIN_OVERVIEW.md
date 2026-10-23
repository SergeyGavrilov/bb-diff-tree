Keep large reviews organized by directory, with file counts and line statistics on every folder. Search paths, collapse unrelated areas, and open the file you want to inspect beside the tree.

## Review the right changes

Choose all branch changes, uncommitted work, the last 1–100 commits, or a single commit. Pick a comparison branch with BB's searchable branch picker. When BB recorded a branch's creation source, Diff Tree uses it as the automatic comparison default.

Switch between unified and split layouts. Expand unchanged lines in either direction to read surrounding code, with syntax highlighting that follows your BB theme. File type icons help distinguish source files, configuration, and documents.

## Bring code into the conversation

Click, Shift-click, or drag across line numbers, then choose **Add to chat**. The selected diff fragment includes its file path, line coordinates, and comparison revision. Add a whole-file mention with the filename header button or Cmd/Ctrl+click in the tree. These actions append to your draft without sending it.

## Open files from chat

Choose BB's default file links, a separate Diff Tree button, or direct opening in Diff Tree. Optional routing works with workspace links and Open buttons in GenUI Changes cards. It reuses the viewer, reveals the selected file, and preserves modified clicks and inline diff expansion. BB's default behavior is selected initially.

## Adjust your viewer

Use **Settings → Diff Tree** to toggle file icons, choose the initial layout, adjust the code font and context expansion size, and control refresh on return. Smooth transitions show a quiet skeleton and fade in the ready diff; animations respect reduced-motion preferences. Background refreshes keep the loaded diff visible.

## Requirements and limits

Requires BB 0.46.1+, Plugin SDK 0.6.49+, and a Git workspace. Commit history runs read-only Git commands on the workspace's enrolled BB host. No API key, paid account, external service, or icon download is needed.

This is a separate thread panel. Binary and oversized files show notices; full-file context is limited to 512 KiB per version and chat quotes to 500 diff rows. The plugin does not stage files, revert changes, or create commits.
