// Pure rendering helpers for the static site. No file or network access here; build.ts does the I/O.

/** A menu entry. A folder (an item with children) may leave out `href`; it then opens its menu but goes nowhere. */
export type NavItem = { label: string; href?: string; children?: NavItem[] };
/** `description` may be left out when the old site had none; layouts that want one use {{descriptionTag}}. */
export type Page = { path: string; title: string; description?: string; file: string; noindex?: boolean };
export type Site = { siteName: string; origin: string; nav: NavItem[] };

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/**
 * The built file for a page path. `/about` becomes a flat about.html and `/about/` becomes about/index.html, so
 * Cloudflare's auto-trailing-slash serves each at exactly the address the old site used.
 */
export function outputPath(path: string): string {
  const trimmed = path.replace(/^\/+|\/+$/g, '');
  if (trimmed === '') return 'index.html';
  return path.endsWith('/') ? `${trimmed}/index.html` : `${trimmed}.html`;
}

export function renderNav(nav: NavItem[], currentPath: string): string {
  const link = (item: NavItem, isFolder: boolean) => {
    if (item.href === undefined) return `<a>${escapeHtml(item.label)}</a>`;
    const current = !isFolder && item.href === currentPath ? ' aria-current="page"' : '';
    return `<a href="${escapeHtml(item.href)}"${current}>${escapeHtml(item.label)}</a>`;
  };
  const items = nav.map((item) =>
    item.children
      ? `<li class="has-menu">${link(item, true)}<ul>${item.children.map((c) => `<li>${link(c, false)}</li>`).join('')}</ul></li>`
      : `<li>${link(item, false)}</li>`,
  );
  return `<ul>${items.join('')}</ul>`;
}

/** Replace `{{> name}}` with the named partial. Unknown names throw so a typo can't ship an empty section. */
export function applyIncludes(body: string, partials: Record<string, string>): string {
  return body.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name: string) => {
    if (!(name in partials)) throw new Error(`Unknown partial: ${name}`);
    return partials[name];
  });
}

/**
 * Fills a theme's layout.html. Placeholders are {{title}}, {{description}}, {{descriptionTag}}, {{indexing}}, {{slug}},
 * {{siteName}}, {{nav}} and {{body}}. {{descriptionTag}} is the whole description meta tag, or nothing for a page
 * without a description. The page body goes in last and is never scanned, so copy can contain braces.
 */
export function renderPage(page: Page, body: string, site: Site, layout: string): string {
  const isHome = page.path === '/';
  const title = isHome ? site.siteName : `${page.title} — ${site.siteName}`;
  const values: Record<string, string> = {
    title: escapeHtml(title),
    description: escapeHtml(page.description ?? ''),
    descriptionTag: page.description ? `<meta name="description" content="${escapeHtml(page.description)}">` : '',
    indexing: page.noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${escapeHtml(site.origin + page.path)}">`,
    slug: isHome ? 'home' : page.path.replace(/^\/+|\/+$/g, '').replace(/\//g, '-'),
    siteName: escapeHtml(site.siteName),
    nav: renderNav(site.nav, page.path),
    body,
  };
  return layout.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    if (!(name in values)) throw new Error(`Unknown layout placeholder: ${name}`);
    return values[name];
  });
}

export function renderRedirects(redirects: Record<string, string>): string {
  return Object.entries(redirects).map(([from, to]) => `${from} ${to} 301\n`).join('');
}

export function renderSitemap(pages: Page[], origin: string): string {
  const urls = pages.filter((p) => !p.noindex).map((p) => `  <url><loc>${escapeHtml(origin + p.path)}</loc></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

/** A preview build must never be indexed: it duplicates the real site on a temporary hostname. */
export function renderRobots(origin: string, preview: boolean): string {
  return preview ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`;
}

/** Cloudflare `_headers` file. Empty outside preview builds. */
export function renderHeaders(preview: boolean): string {
  return preview ? '/*\n  X-Robots-Tag: noindex, nofollow\n' : '';
}
