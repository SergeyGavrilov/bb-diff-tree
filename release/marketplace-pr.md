## Diff Tree

Adds a searchable directory-tree diff panel to BB threads, with branch and commit comparisons, expandable context, and line/file actions that append to the chat draft without submitting.

Source: `https://github.com/SergeyGavrilov/bb-diff-tree.git`, using the `^0.1.0` release range. Before opening this PR, verify its `v0.1.0` tag and author GitHub account.

## Validation

Record the final plugin typecheck, test, build, release-package check, and marketplace build/check results here after running them on the release commit. Do not claim source liveness before the public tag exists.

## Access and dependencies

Uses the public SDK to read the current thread's environment. Committed comparisons execute bounded read-only Git commands on that environment's enrolled host, without a shell or network Git operations. The server resolves the workspace and host from the environment ID. Composer actions append to drafts and never send messages. No API keys, paid accounts, telemetry, or external icon requests are added. Seti icons are bundled and attributed under MIT.

## Listing assets

The overview is copied from the plugin repository's `PLUGIN_OVERVIEW.md`. The icon is the plugin's own monochrome SVG. The author-supplied `overview.png` shows the installed plugin with its directory tree, unified source diff, selected lines, and Add to chat action. The image is 2134×2240 pixels and below 2 MiB.
