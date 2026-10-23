## Diff Tree v0.1.1 overview

Updates the existing Diff Tree overview to describe optional chat file navigation, BB-managed viewer settings, and smooth diff transitions. The existing icon, screenshot, short description, and source range are unchanged.

Source: `https://github.com/SergeyGavrilov/bb-diff-tree.git`, retaining the `^0.1.0` release range. Before opening this PR, verify its `v0.1.1` tag and author GitHub account. Compatible release selection does not require an entry change.

## Validation

Record the final plugin typecheck, test, build, release-package check, and marketplace build/check results here after running them on the release commit. Do not claim source liveness before the public tag exists.

## Access and dependencies

Uses the public SDK to read the current thread's environment. Committed comparisons execute bounded read-only Git commands on that environment's enrolled host, without a shell or network Git operations. The server resolves the workspace and host from the environment ID. Composer actions append to drafts and never send messages. Optional chat navigation uses a cleanup-safe content script over workspace links and supported GenUI controls; BB's default link behavior remains the initial setting. No API keys, paid accounts, telemetry, or external icon requests are added. Seti icons are bundled and attributed under MIT.

## Listing assets

The overview is copied from the plugin repository's `PLUGIN_OVERVIEW.md` at v0.1.1. Existing branding is reused: the plugin's monochrome SVG and the author-supplied `overview.png` showing the installed plugin with its directory tree, unified source diff, selected lines, and Add to chat action. The image is 2134×2240 pixels and below 2 MiB.
