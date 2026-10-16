// Checks on the built site. Each returns plain-English problems; an empty list means it passed.

const ATTR = /\b(?:href|src)=["']([^"']*)["']/gi;
const SRCSET = /\bsrcset=["']([^"']*)["']/gi;

/**
 * The built files that can answer a link or image address, best match first, or null when it points off the site.
 * A page address can be built as a flat file (about.html) or a folder (about/index.html); Cloudflare's
 * auto-trailing-slash serves either one at /about and /about/, redirecting from the other form.
 */
export function targetFiles(ref: string, fromFile: string): string[] | null {
  if (!ref || ref.startsWith('#') || ref.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(ref)) return null;
  const url = new URL(ref, `https://site.invalid/${fromFile}`);
  const pathname = decodeURIComponent(url.pathname);
  const path = pathname.replace(/^\/+|\/+$/g, '');
  if (path === '') return ['index.html'];
  if (/\.[a-z0-9]+$/i.test(path)) return [path];
  return pathname.endsWith('/') ? [`${path}/index.html`, `${path}.html`] : [`${path}.html`, `${path}/index.html`];
}

/** Every internal link, image and stylesheet must lead to a built file or to an old address that redirects. */
export function checkLinks(html: Record<string, string>, files: Set<string>, redirects: Record<string, string>): string[] {
  const redirected = new Set(Object.keys(redirects).flatMap((from) => targetFiles(from, 'index.html') ?? []));
  const issues: string[] = [];
  for (const [file, source] of Object.entries(html)) {
    const refs = [...source.matchAll(ATTR)].map((m) => m[1]);
    for (const m of source.matchAll(SRCSET)) refs.push(...m[1].split(',').map((part) => part.trim().split(/\s+/)[0]));
    for (const ref of new Set(refs)) {
      const targets = targetFiles(ref, file);
      if (targets && !targets.some((t) => files.has(t) || redirected.has(t))) issues.push(`${file}: link to ${ref} goes nowhere`);
    }
  }
  return issues;
}

/** Every image needs an alt attribute. An empty one is fine for decoration. */
export function checkImages(html: Record<string, string>): string[] {
  const issues: string[] = [];
  for (const [file, source] of Object.entries(html)) {
    for (const [tag] of source.matchAll(/<img\b[^>]*>/gi)) {
      if (!/\balt=/i.test(tag)) issues.push(`${file}: image ${tag.match(/\bsrc=["']([^"']*)["']/i)?.[1] ?? '?'} has no description (alt text)`);
    }
  }
  return issues;
}

/** A protected fact, like the phone number, must still be shown somewhere on the site. */
export function checkFacts(html: Record<string, string>, facts: Record<string, string>): string[] {
  const text = Object.values(html).join('\n').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
  return Object.entries(facts).filter(([, value]) => !text.includes(value)).map(([key, value]) => `${key} "${value}" no longer appears on any page`);
}
