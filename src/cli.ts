#!/usr/bin/env node
// sitekit build [--preview] | check | guard [--base <ref>] [--allow-protected] | ready
// Run from the root of a site repo.
import { execFileSync } from 'node:child_process';
import { buildSite, loadConfig, readBuiltSite } from './build.ts';
import { checkFacts, checkImages, checkLinks } from './checks.ts';
import { changedProtected, classifyChanges, unsavedFiles } from './guard.ts';

const [command, ...args] = process.argv.slice(2);
const root = process.cwd();
const flag = (name: string) => args.includes(name);
const option = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const git = (...argv: string[]) => execFileSync('git', argv, { cwd: root, encoding: 'utf8' });
const list = (items: string[]) => items.map((item) => `  - ${item}`).join('\n');

async function build() {
  const summary = await buildSite({ root, preview: flag('--preview') || process.env.SITE_PREVIEW === '1' });
  console.log(`Built ${summary.pages} pages and ${summary.redirects} redirects${summary.preview ? ' (preview: hidden from search engines)' : ''}.`);
}

async function check() {
  const config = await loadConfig(root);
  const built = await readBuiltSite(root);
  const issues = [...checkLinks(built.html, built.files, config.redirects), ...checkImages(built.html), ...checkFacts(built.html, config.facts)];
  if (issues.length) throw new Error(`The site has ${issues.length === 1 ? 'a problem' : `${issues.length} problems`}:\n${list(issues)}`);
  console.log(`Checks passed: ${Object.keys(built.html).length} pages, no broken links, every image described, every protected fact present.`);
}

async function guard() {
  const base = option('--base') ?? 'HEAD';
  const changed = [...git('diff', '--name-only', '--no-renames', base).split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')].filter(Boolean);
  const { allowed, blocked } = classifyChanges([...new Set(changed)]);
  if (blocked.length) throw new Error(`These files are outside what may be edited (content/, public/images/, site.json):\n${list(blocked)}`);

  let before: unknown = {};
  try {
    before = JSON.parse(git('show', `${base}:site.json`));
  } catch {
    // No earlier site.json: a brand new site has nothing to protect yet.
  }
  const protectedChanges = changedProtected(before as object, await loadConfig(root));
  if (protectedChanges.length && !flag('--allow-protected')) {
    throw new Error(`Protected details changed. Confirm with the owner, then re-run with --allow-protected:\n${list(protectedChanges)}`);
  }
  console.log(allowed.length ? `Changes are within bounds:\n${list(allowed)}` : 'Nothing has changed.');
  if (protectedChanges.length) console.log(`Protected details changed, as confirmed:\n${list(protectedChanges)}`);
}

/** Publishing waits until every change is saved, so whatever is live can be found again, and undone, in the history. */
async function ready() {
  const unsaved = unsavedFiles(git('status', '--porcelain'));
  if (unsaved.length) throw new Error(`Not published: these changes aren't saved yet. Save them (or undo them) first:\n${list(unsaved)}`);
  console.log('Everything is saved.');
}

const commands: Record<string, () => Promise<void>> = { build, check, guard, ready };
try {
  if (!commands[command]) throw new Error('Usage: sitekit build [--preview] | check | guard [--base <ref>] [--allow-protected] | ready');
  await commands[command]();
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}
