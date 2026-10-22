# Release screenshots

Capture the installed Diff Tree plugin in BB with public sample code. Do not draw a mockup or publish unrelated chat, private code, tokens, email addresses, or home directory paths.

The Community marketplace accepts PNG, JPEG, or WebP, at least 1200 pixels wide and at most 2 MiB per image. Prefer device pixel ratio 2 when available. The preparation script currently accepts PNG screenshots.

`overview.png` is the author-supplied screenshot of the installed plugin (2134×2240 pixels, below 2 MiB), approved for this release. It shows the expanded directory tree, unified diff, and a line selection with Add to chat.

For future releases, useful complementary views are:

- `overview.png`: a wide panel with an expanded directory tree, file statistics, a selected source file, and the All changes/base controls.
- `review.png`: a selected commit or recent commit range, split diff, and either expanded unchanged context or a visible line-selection Add to chat action.

Inspect every image before publication. These files can also be used in the GitHub README. The preparation script copies approved PNGs into `release/marketplace/screenshots/diff-tree/` and references them from the entry; the marketplace copy must use those exact files.

The initial release uses `overview.png`. A separate `review.png` is optional and has not been added.
