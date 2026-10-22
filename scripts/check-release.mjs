#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(resolve(root, path), 'utf8');
const pkg = JSON.parse(read('package.json'));
const id = pkg.name.split('/').pop().replace(/^bb-plugin-/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
assert.equal(id, 'diff-tree');
assert.match(pkg.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
assert.equal(pkg.license, 'MIT');
assert.ok(pkg.engines.bb && pkg.engines.bbPluginSdk);
assert.ok(pkg.bb.description.length <= 140, 'Keep the listing hook below 140 characters');
for (const key of ['server', 'app', 'host']) {
  assert.ok(existsSync(resolve(root, pkg.bb[key])), `Missing ${key} source`);
}
for (const file of ['dist/server.js', 'dist/server.meta.json', 'dist/app.js', 'dist/app.css', 'dist/app.meta.json', 'dist/host.js', 'dist/host.meta.json', 'assets/icon.svg', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'README.md', 'PLUGIN_OVERVIEW.md', 'CHANGELOG.md']) {
  assert.ok(existsSync(resolve(root, file)), `Missing ${file}; run npm run build first`);
}
for (const name of ['server', 'app', 'host']) JSON.parse(read(`dist/${name}.meta.json`));
const overview = read('PLUGIN_OVERVIEW.md');
assert.ok(overview.length > 0 && overview.length <= 4000, 'Overview must contain 1–4000 characters');
assert.ok(!/^# /m.test(overview), 'Overview uses section headings, without a page title');
assert.ok(!/<\/?[a-z]|!\[|^\||^\s*- \[[ x]\]/im.test(overview), 'Overview cannot contain HTML, images, tables, or task lists');
for (const link of overview.matchAll(/\]\(([^)]+)\)/g)) assert.ok(link[1].startsWith('https://'), 'Overview links must use absolute HTTPS URLs');
const listing = JSON.parse(read('release/marketplace-listing.json'));
assert.equal(listing.id, id);
assert.equal(listing.displayName, pkg.bb.name);
assert.equal(listing.category, 'code-and-reviews');
assert.ok(read('CHANGELOG.md').includes(`## ${pkg.version}`), 'Add the version to CHANGELOG.md');

// Inspect the actual npm allowlist, not a separate list that can drift from it.
const npm = process.env.npm_execpath;
const command = npm ? process.execPath : 'npm';
const args = [...(npm ? [npm] : []), 'pack', '--dry-run', '--ignore-scripts', '--json'];
const packed = JSON.parse(execFileSync(command, args, { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }))[0];
const files = new Set(packed.files.map(file => file.path));
for (const file of ['package.json', 'dist/server.js', 'dist/server.meta.json', 'dist/app.js', 'dist/app.css', 'dist/app.meta.json', 'dist/host.js', 'dist/host.meta.json', 'assets/icon.svg', 'skills/diff-tree/SKILL.md', 'PLUGIN_OVERVIEW.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md']) {
  assert.ok(files.has(file), `Release package omits ${file}`);
}
for (const file of files) assert.ok(!/^(?:tests|node_modules|\.git|release)\//.test(file) && !/(?:^|\/)\.env(?:\.|$)|\.test\.[tj]sx?$/.test(file), `Development/private file in package: ${file}`);
console.log(`Local release package verified: ${pkg.name}@${pkg.version} (${id}).`);
console.log('Local verification does not validate GitHub authentication or the public release tag. See docs/RELEASING.md.');
