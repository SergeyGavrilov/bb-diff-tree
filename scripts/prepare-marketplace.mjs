#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const { values } = parseArgs({ options: {
  repo: { type: 'string' }, github: { type: 'string' }, screenshot: { type: 'string', multiple: true },
  out: { type: 'string' }, help: { type: 'boolean' },
} });
if (values.help) {
  console.log('node scripts/prepare-marketplace.mjs --repo OWNER/REPO --github LOGIN --screenshot overview.png [--screenshot review.png] [--out DIRECTORY]');
  process.exit(0);
}
const fail = message => { throw new Error(message); };
const login = /^[A-Za-z0-9](?:-?[A-Za-z0-9]){0,38}$/;
const repository = values.repo?.split('/');
if (!repository || repository.length !== 2 || !login.test(repository[0]) || !/^[A-Za-z0-9_.-]+$/.test(repository[1]) || repository[1] === '.' || repository[1] === '..') fail('--repo must be a GitHub OWNER/REPO');
if (!values.github || !login.test(values.github)) fail('--github must name the submitting GitHub account');
if (!values.screenshot?.length || values.screenshot.length > 6) fail('Provide 1–6 real PNG screenshots of the installed plugin');
const names = new Set();
const screenshots = values.screenshot.map(path => {
  const bytes = readFileSync(path), name = basename(path);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.png$/.test(name) || names.has(name)) fail('Screenshots need unique PNG filenames without spaces');
  names.add(name);
  if (bytes.length > 2 * 1024 * 1024 || bytes.length < 67 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || bytes.readUInt32BE(8) !== 13 || bytes.toString('ascii', 12, 16) !== 'IHDR' || bytes.toString('ascii', bytes.length - 8, bytes.length - 4) !== 'IEND' || bytes.readUInt32BE(20) === 0) fail(`Invalid or oversized PNG: ${name}`);
  if (bytes.readUInt32BE(16) < 1200) fail(`Screenshot must be at least 1200 pixels wide: ${name}`);
  return { path, name };
});
const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const entry = JSON.parse(readFileSync(join(root, 'release/marketplace-listing.json'), 'utf8'));
const icon = readFileSync(join(root, 'assets/icon.svg'));
const iconName = `diff-tree-${createHash('sha256').update(icon).digest('hex').slice(0, 8)}.svg`;
entry.icon = { url: `./icons/${iconName}` };
entry.author.github = values.github;
entry.author.url = `https://github.com/${values.github}`;
entry.source = { git: { url: `https://github.com/${values.repo}.git`, range: `^${pkg.version}` } };
entry.screenshots = screenshots.map(({ name }) => `./screenshots/diff-tree/${name}`);
const out = resolve(root, values.out ?? 'release/marketplace');
if (existsSync(out)) fail(`Output already exists; choose a new --out directory: ${out}`);
mkdirSync(dirname(out), { recursive: true });
mkdirSync(out);
for (const dir of ['entries', 'icons', 'overview', 'screenshots/diff-tree']) mkdirSync(join(out, dir), { recursive: true });
writeFileSync(join(out, 'entries/diff-tree.json'), JSON.stringify(entry, null, 2) + '\n');
writeFileSync(join(out, 'icons', iconName), icon);
copyFileSync(join(root, 'PLUGIN_OVERVIEW.md'), join(out, 'overview/diff-tree.md'));
for (const { path, name } of screenshots) copyFileSync(path, join(out, 'screenshots/diff-tree', name));
console.log(`Prepared marketplace files in ${out}. No remote state changed.`);
console.log('Inspect the images, verify the public v' + pkg.version + ' tag and author, then run marketplace build/check before opening a PR.');
