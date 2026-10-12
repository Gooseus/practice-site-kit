// Builds a site repo into dist/: the kit's theme, the site's own public files, and one HTML file per page.
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseSiteConfig, type SiteConfig } from './config.ts';
import { applyIncludes, outputPath, renderHeaders, renderPage, renderRedirects, renderRobots, renderSitemap } from './render.ts';

const THEME = new URL('../theme/', import.meta.url);

export async function loadConfig(root: string): Promise<SiteConfig> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(join(root, 'site.json'), 'utf8'));
  } catch (err) {
    throw new Error(`site.json could not be read: ${(err as Error).message}`);
  }
  return parseSiteConfig(raw);
}

/** `preview` builds the copy for a temporary address: same pages, hidden from search engines. */
export async function buildSite({ root, preview = false }: { root: string; preview?: boolean }) {
  const config = await loadConfig(root);
  const dist = join(root, 'dist');
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  await cp(THEME, dist, { recursive: true });
  await cp(join(root, 'public'), dist, { recursive: true });

  const partials: Record<string, string> = {};
  for (const file of await readdir(join(root, 'content/partials')).catch(() => [])) {
    partials[file.replace(/\.html$/, '')] = await readFile(join(root, 'content/partials', file), 'utf8');
  }
  for (const page of config.pages) {
    const body = applyIncludes(await readFile(join(root, 'content/pages', page.file), 'utf8'), partials);
    const out = join(dist, outputPath(page.path));
    await mkdir(join(out, '..'), { recursive: true });
    await writeFile(out, renderPage(page, body, config));
  }

  await writeFile(join(dist, '_redirects'), renderRedirects(config.redirects));
  await writeFile(join(dist, 'sitemap.xml'), renderSitemap(config.pages, config.origin));
  await writeFile(join(dist, 'robots.txt'), renderRobots(config.origin, preview));
  if (preview) await writeFile(join(dist, '_headers'), renderHeaders(preview));
  return { pages: config.pages.length, redirects: Object.keys(config.redirects).length, preview };
}

/** What a build produced: every file path under dist/, and the HTML of each page. */
export async function readBuiltSite(root: string): Promise<{ files: Set<string>; html: Record<string, string> }> {
  const dist = join(root, 'dist');
  const entries = await readdir(dist, { recursive: true, withFileTypes: true });
  const files = new Set<string>();
  const html: Record<string, string> = {};
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name).slice(dist.length + 1).split('\\').join('/');
    files.add(path);
    if (path.endsWith('.html')) html[path] = await readFile(join(dist, path), 'utf8');
  }
  return { files, html };
}
