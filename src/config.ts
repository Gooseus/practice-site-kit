// The site's settings file, site.json: name, web address, menu, page list, old-address redirects,
// and the facts that must never change by accident.
import type { NavItem, Page } from './render.ts';

export type SiteConfig = {
  siteName: string;
  origin: string;
  facts: Record<string, string>;
  nav: NavItem[];
  pages: Page[];
  redirects: Record<string, string>;
};

const isObject = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/** Validates site.json. Throws one error listing every problem, worded for the person editing the file. */
export function parseSiteConfig(input: unknown): SiteConfig {
  if (!isObject(input)) throw new Error('site.json must be an object');
  const problems: string[] = [];
  const { siteName, origin } = input;
  const facts = isObject(input.facts) ? input.facts : {};
  const nav: NavItem[] = Array.isArray(input.nav) ? input.nav : [];
  const pages: Page[] = Array.isArray(input.pages) ? input.pages : [];
  const redirects: Record<string, string> = isObject(input.redirects) ? input.redirects : {};

  if (!isText(siteName)) problems.push('siteName is missing');
  if (!isText(origin) || !/^https:\/\/[a-z0-9.-]+$/i.test(origin)) problems.push('origin must look like https://www.example.com (no trailing slash)');
  if (pages.length === 0) problems.push('pages is empty');

  const paths = new Set<string>();
  for (const page of pages) {
    const name = `page "${page?.path ?? '?'}"`;
    if (!isText(page?.path) || !page.path.startsWith('/')) problems.push(`${name}: path must start with /`);
    if (!isText(page?.title)) problems.push(`${name}: title is missing`);
    if (!isText(page?.description)) problems.push(`${name}: description is missing`);
    if (!isText(page?.file) || !/^[\w-]+\.html$/.test(page.file)) problems.push(`${name}: file must be a plain .html file name`);
    if (paths.has(page?.path)) problems.push(`${name} is listed twice`);
    paths.add(page?.path);
  }

  const internal = (href: unknown) => isText(href) && href.startsWith('/');
  for (const item of nav.flatMap((n) => [n, ...(n.children ?? [])])) {
    if (!isText(item?.label) || !isText(item?.href)) problems.push('every menu link needs a label and an href');
    else if (internal(item.href) && !paths.has(item.href)) problems.push(`menu link "${item.label}" points to ${item.href}, which is not a page`);
  }
  for (const [from, to] of Object.entries(redirects)) {
    if (paths.has(from)) problems.push(`redirect ${from} is also a page`);
    if (internal(to) && !paths.has(to)) problems.push(`redirect ${from} points to ${to}, which is not a page`);
  }
  for (const [key, value] of Object.entries(facts)) if (!isText(value)) problems.push(`fact "${key}" is empty`);

  if (problems.length) throw new Error(`site.json has ${problems.length === 1 ? 'a problem' : 'problems'}:\n- ${problems.join('\n- ')}`);
  return { ...input, siteName, origin, facts, nav, pages, redirects } as SiteConfig;
}
