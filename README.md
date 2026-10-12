# practice-site-kit

Layout, build and checks shared by small practice websites. A site repo holds only its own words,
photos and settings, and depends on a version of this kit.

| Part | What it does |
|---|---|
| `src/render.ts` | Page layout, menu, sitemap, robots, redirects |
| `src/config.ts` | Reads and validates a site's `site.json` |
| `src/build.ts` | `theme/` + the site's `public/` + its pages -> `dist/` |
| `src/checks.ts` | Broken links, images without alt text, protected facts still on the site |
| `src/guard.ts` | Blocks changes outside `content/`, `public/images/` and `site.json`; flags changed facts |
| `src/cli.ts` | `sitekit build [--preview]`, `sitekit check`, `sitekit guard [--base <ref>] [--allow-protected]` |
| `theme/` | The stylesheet and fonts every site gets |
| `rules.md` | Instructions for the AI working in a site repo. Each site's `CLAUDE.md` imports it. |

```
npm test        # node:test, runs the TypeScript directly
npm run build   # emits dist/, which is what site repos run
```

Site repos run `dist/`, so rebuild after changing `src/`. Node won't strip types from a package under `node_modules`.

## A site repo

```
content/pages/    one HTML fragment per page
content/partials/ optional shared fragments, used as {{> name}}
public/images/    photos and icons
site.json         siteName, origin, facts, nav, pages, redirects
wrangler.jsonc    Cloudflare Workers static assets; no Worker code
CLAUDE.md         site-specific notes, then @node_modules/practice-site-kit/rules.md
.claude/          permission settings for the AI
```

## Not built yet

- **Pipeline.** Sites deploy by hand with wrangler. The plan is GitHub plus Cloudflare builds: a branch gets a
  preview, merging publishes, and `sitekit guard --base origin/main` runs there. Until then the guard is advisory:
  the permission settings in a site repo stop honest mistakes, not a determined agent.
- **Themes.** There is one, lifted from maryrower.com (a Squarespace 7.0 template). A second site will show what
  has to become a setting.
- **Skill pack, new-site template, site importers.** The Squarespace and WordPress scrapers live in the site repos for now.
- **Image resizing.** Photos are prepared by hand.
