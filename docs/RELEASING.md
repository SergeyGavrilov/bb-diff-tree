# Releasing Diff Tree

The current release is **0.1.1**, package **bb-plugin-diff-tree**, plugin ID **diff-tree**, Git tag **v0.1.1**. The distribution source is a public GitHub repository with the semver range **^0.1.0**; publishing to npm is optional and is not part of this release plan.

## Before each release

The repository is `https://github.com/SergeyGavrilov/bb-diff-tree`, with SSH origin `git@github.com:SergeyGavrilov/bb-diff-tree.git`. Package metadata and the README use that destination. The listing author is `SergeyGavrilov`; verify the authenticated submitting account before opening the marketplace PR. Releases are published from reviewed, immutable semver tags.

The project uses MIT. Review the license, author, listing text in `PLUGIN_OVERVIEW.md`, and release notes before committing each release.

The author supplied the real installed-plugin screenshot in `docs/screenshots/overview.png` (2134×2240 pixels, below 2 MiB). It shows the tree, unified diff, and Add to chat selection and is used in the README and Community submission. Additional screenshots are optional; follow [screenshots/README.md](screenshots/README.md) for future captures.

## Validate the release checkout

Use Node 22.19+ or 24+, npm, Git, and BB 0.46.1+ with SDK 0.6.49+:

```sh
npm ci --ignore-scripts
npm run check
bb plugin types --check .
npm run build
npm run check:release
bb plugin reload diff-tree
npm pack --dry-run --ignore-scripts
```

The release check validates package contents, entry points, built artifacts, listing identity, overview constraints, and attribution. It checks the local package; it does not prove a public tag exists or replace marketplace validation.

Use a clean checkout to verify the Git installation path: install production dependencies with lifecycle scripts disabled and build with BB. Git installs omit development dependencies, so all runtime packages must remain in dependencies. React, Pierre, and the SDK are supplied by BB's runtime shims.

Check the real panel in both layouts and both themes. Verify context expansion, chat mentions/quotes, comparison scopes, rename/delete cases, and the environment's host integration.

## Approve and create the GitHub release

Before the first push or tag, review the exact GitHub account, public repository URL, release commit SHA, package/version, source range, and every remote-changing command. Preparation does not authorize publication.

Once the destination and screenshots are ready:

1. Finalize the README links, listing, and release notes. Replace **Unreleased** in CHANGELOG.md with the release date.
2. Commit the reviewed release files and record `git rev-parse HEAD`.
3. Confirm the authenticated account with `gh auth status` and `gh api user --jq .login`.
4. Confirm the repository is public and the intended remote matches `git remote -v`.
5. After explicit release approval, create the annotated `v0.1.1` tag and push the reviewed main commit and tag.

The `Publish GitHub release` workflow builds, tests, validates, packs, and publishes a GitHub release when the approved tag is pushed. The release uses `release/github-notes.md` and includes the package archive. Review those files before pushing the tag, then check the workflow and release page. Do not create a duplicate release manually.

Verify the tag with `git ls-remote --tags` and install the public Git source through BB. Semver tags are immutable: ship a new version for fixes instead of moving a tag.

If a tag push did not trigger the workflow, run **Publish GitHub release** manually from the Actions page on `main`, entering the existing tag. The workflow checks out that tag and validates its package version before publishing. This also avoids moving an existing tag when recovering a missed trigger.

CI uses Node 22 and the pinned official `bb-app@0.46.1` CLI. Keep its version and the supported SDK/Pierre declarations aligned when upgrading BB support. Check both the CI and release workflow results for every release.

## Prepare the BB Community submission

The existing marketplace entry tracks `^0.1.0`, so compatible 0.1.x tags are eligible without a new source entry. For v0.1.1, preserve that source range, short description, icon, and screenshot. Submit a separate PR updating only the overview to cover the new settings and chat navigation; do not add another entry. This keeps the frozen v1 document unchanged.

Read the current contracts on the default branch of [get-bb/marketplace](https://github.com/get-bb/marketplace), especially `schema/marketplace-v2.schema.json`, `marketplace.base.json`, and its screenshot/overview rules. The checked category is `code-and-reviews`.

Generate a complete local submission after the account, repository, and screenshots are known:

```sh
node scripts/prepare-marketplace.mjs \
  --repo SergeyGavrilov/bb-diff-tree \
  --github SergeyGavrilov \
  --screenshot docs/screenshots/overview.png
```

The initial bundle is already generated locally. Use `--out` for a new bundle if that directory exists. The script writes an ignored `release/marketplace/` directory with `entries/diff-tree.json`, a content-hashed vendored SVG icon, `overview/diff-tree.md`, and referenced screenshots. It never pushes or submits anything. It rejects missing screenshots and refuses to overwrite an existing output directory. `--out` selects another output directory.

Copy those generated directories into a clean fork of `get-bb/marketplace` on a `submit-diff-tree` branch. Confirm `author.github` is the account opening the PR. The overview comes from the plugin's reviewed `PLUGIN_OVERVIEW.md`.

Run the marketplace checks:

```sh
npm ci --ignore-scripts
npm run build
npm test
npm run gate:v1
npm run check
git diff --check
```

`npm run check` verifies the remote source: it can only pass for the new entry once the public release tag exists. Do not claim a source check passed during local preparation.

Commit only the entry, icon, overview, and referenced screenshots. Complete `release/marketplace-pr.md` with the exact source and validation results, then open the marketplace PR from the verified submitter account. Do not include generated dist files or unrelated changes.

