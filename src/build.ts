// Builds a site repo into dist/: the chosen theme's files, the site's own public files, and one HTML file per page.
// A theme is a folder in themes/ with a layout.html (see renderPage) and whatever stylesheets and fonts it needs.
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseSiteConfig, type SiteConfig } from './config.ts';
import { applyIncludes, outputPath, renderHeaders, renderPage, renderRedirects, renderRobots, renderSitemap } from './render.ts';

const THEMES = new URL('../themes/', import.meta.url).pathname;

export async function loadConfig(root: string): Promise<SiteConfig> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(join(root, 'site.json'), 'utf8'));
  } catch (err) {
    throw new Error(`site.json could not be read: ${(err as Error).message}`);
  }
  return parseSiteConfig(raw);
}

async function findTheme(themes: string, name: string): Promise<string> {
  const available = (await readdir(themes, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
  if (!available.includes(name)) throw new Error(`There is no theme called "${name}". Themes: ${available.sort().join(', ')}`);
  return join(themes, name);
}

/** `preview` builds the copy for a temporary address: same pages, hidden from search engines. `themes` is for tests. */
export async function buildSite({ root, preview = false, themes = THEMES }: { root: string; preview?: boolean; themes?: string }) {
  const config = await loadConfig(root);
  const theme = await findTheme(themes, config.theme);
  const dist = join(root, 'dist');
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  await cp(theme, dist, { recursive: true, filter: (src) => src !== join(theme, 'layout.html') });
  await cp(join(root, 'public'), dist, { recursive: true });

  const partials: Record<string, string> = {};
  for (const file of await readdir(join(root, 'content/partials')).catch(() => [])) {
    partials[file.replace(/\.html$/, '')] = await readFile(join(root, 'content/partials', file), 'utf8');
  }
  const layout = applyIncludes(await readFile(join(theme, 'layout.html'), 'utf8'), partials);
  for (const page of config.pages) {
    const body = applyIncludes(await readFile(join(root, 'content/pages', page.file), 'utf8'), partials);
    const out = join(dist, outputPath(page.path));
    await mkdir(join(out, '..'), { recursive: true });
    await writeFile(out, renderPage(page, body, config, layout));
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
