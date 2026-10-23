# Diff Tree v0.1.1

Customize your diff viewer and open workspace files from chat in Diff Tree.

- Choose BB's default file links, a separate Diff Tree button, or direct opening in Diff Tree. Chat routing is opt-in and also supports Open buttons in GenUI Changes/Commits cards.
- Reuse the viewer tab, select the requested file, reveal its parent folders, and show a native-file fallback when the comparison has no changes for that path.
- Configure file icons, initial Unified/Split layout, code font size, unchanged-line expansion size, and refresh on return under Settings → Diff Tree.
- Replace visible loading text with a quiet skeleton and a short fade. Smooth diff transitions are optional and honor reduced-motion preferences.
- Keep loaded diffs visible during background refreshes and update the patch and full context together, avoiding loading flashes and duplicate initial requests.

Requires BB 0.46.1+, Plugin SDK 0.6.49+, and Git on the workspace host for history. No external service or account is required.

Install the release with:

```sh
bb plugin install 'git:https://github.com/SergeyGavrilov/bb-diff-tree.git@^0.1.0'
```

Existing Plugin Hub installs track the compatible `^0.1.0` range. Refresh the plugin's update check in BB to select this release.

Optional chat routing uses a content script limited to workspace links and supported chat file controls. BB's default link behavior remains the initial setting. See README for supported controls, settings, and limits.
