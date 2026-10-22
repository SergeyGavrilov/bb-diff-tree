# Contributing

Use Node 22.19+ or 24+, npm, Git, and BB 0.46.1+ with SDK 0.6.49+.

```sh
npm ci --ignore-scripts
npm run check
bb plugin types --check .
npm run build
npm run check:release
```

Install the checkout with `bb plugin install .`, then run `bb plugin dev .` while working on the UI. For a one-off rebuild, use `npm run build` followed by `bb plugin reload diff-tree`.

## Code boundaries

- `src/app` owns React components and SDK hooks.
- `src/core` owns tree, comparison, context, and quote behavior; it must not import React hooks or backend code.
- `src/host` runs bounded read-only Git operations on the enrolled workspace machine.
- `src/server` resolves environment IDs and routes calls to the correct host.
- `src/shared/contracts.ts` validates RPC inputs and outputs.

Use public Plugin SDK surfaces and BB's shared runtime. Keep the SDK and Pierre declarations aligned with the tested BB version. Do not import private BB modules or bundle another React/Pierre runtime.

Git commands must use argument arrays without a shell, literal pathspecs, bounded output, and cancellation. Frontend input must not choose arbitrary workspace or host paths. Chat actions must preserve the draft and never send it.

## Verification

Add focused behavioral coverage for changes to comparison logic, Git handling, quoting, or interactions. Tests live in `tests`, with environment fixtures in `tests/fixtures`. The host tests create disposable Git repositories. The panel tests exercise the real Pierre renderer; jsdom does not validate layout or native BB integration.

Check both diff layouts and light/dark themes in BB for visible changes. Include the behavior change and relevant validation in a pull request. Update README and PLUGIN_OVERVIEW together when a user-facing capability changes.

Use [docs/RELEASING.md](docs/RELEASING.md) for versioning, package checks, GitHub releases, and the Community marketplace.
