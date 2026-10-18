// Decides whether a set of changes stays inside what a site's owner (or their AI) may edit.

/** The only places routine edits belong. Layout, hosting settings and the rules themselves are off limits. */
export const EDITABLE = ['content/', 'public/images/', 'site.json'];

export function classifyChanges(paths: string[], editable: string[] = EDITABLE): { allowed: string[]; blocked: string[] } {
  const ok = (path: string) => editable.some((e) => (e.endsWith('/') ? path.startsWith(e) : path === e));
  return { allowed: paths.filter(ok), blocked: paths.filter((p) => !ok(p)) };
}

type Protected = { origin?: string; theme?: string; facts?: Record<string, string> };

/** Changes to the web address, the theme or a protected fact. These are allowed only when someone asked for them. */
export function changedProtected(before: Protected, after: Protected): string[] {
  const changes: string[] = [];
  if (before.origin !== after.origin) changes.push(`web address: ${before.origin ?? '(none)'} → ${after.origin ?? '(removed)'}`);
  if (before.theme !== after.theme) changes.push(`theme: ${before.theme ?? '(none)'} → ${after.theme ?? '(removed)'}`);
  const was = before.facts ?? {};
  const now = after.facts ?? {};
  for (const key of new Set([...Object.keys(was), ...Object.keys(now)])) {
    if (was[key] !== now[key]) changes.push(`${key}: ${was[key] ?? '(none)'} → ${now[key] ?? '(removed)'}`);
  }
  return changes;
}

/** Files with unsaved changes, from `git status --porcelain`. Publishing waits until this is empty, so the live site is always a saved version. */
export function unsavedFiles(porcelain: string): string[] {
  return porcelain
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => line.slice(3).split(' -> ').pop()!);
}
