import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSite, readBuiltSite, themesDir } from '../src/build.ts';

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'sitekit-'));
  await mkdir(join(root, 'content/pages'), { recursive: true });
  await mkdir(join(root, 'content/partials'), { recursive: true });
  await mkdir(join(root, 'public/images'), { recursive: true });
  await writeFile(join(root, 'site.json'), JSON.stringify({
    siteName: 'Test Practice',
    origin: 'https://www.example.com',
    theme: 'sea-girt',
    nav: [{ label: 'Home', href: '/' }, { label: 'About', href: '/about' }],
    pages: [
      { path: '/', title: 'Home', file: 'home.html', description: 'Welcome.' },
      { path: '/about', title: 'About', file: 'about.html', description: 'About us.' },
    ],
    redirects: { '/old': '/about' },
  }));
  await writeFile(join(root, 'content/pages/home.html'), '<h1>Hello</h1>{{> hours}}');
  await writeFile(join(root, 'content/pages/about.html'), '<h1>About</h1><img src="/images/a.png" alt="">');
  await writeFile(join(root, 'content/partials/hours.html'), '<p>Open weekdays</p>');
  await writeFile(join(root, 'public/images/a.png'), 'png');
  return root;
}

test('buildSite writes each page, the theme, the site files and the redirects into dist', async (t) => {
  // Arrange
  const root = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));

  // Act
  const summary = await buildSite({ root });

  // Assert
  const home = await readFile(join(root, 'dist/index.html'), 'utf8');
  assert.match(home, /<title>Test Practice<\/title>/);
  assert.match(home, /<h1>Hello<\/h1><p>Open weekdays<\/p>/);
  assert.match(await readFile(join(root, 'dist/about.html'), 'utf8'), /<link rel="canonical" href="https:\/\/www\.example\.com\/about">/);
  assert.equal(await readFile(join(root, 'dist/_redirects'), 'utf8'), '/old /about 301\n');
  assert.match(await readFile(join(root, 'dist/robots.txt'), 'utf8'), /Sitemap: https:\/\/www\.example\.com\/sitemap\.xml/);
  const files = await readdir(join(root, 'dist'));
  for (const expected of ['styles.css', 'fonts', 'images', 'sitemap.xml']) assert.ok(files.includes(expected), expected);
  assert.ok(!files.includes('layout.html'), 'the layout is a template, not a page');
  assert.ok(!files.includes('_headers'));
  assert.deepEqual(summary, { pages: 2, redirects: 1, preview: false });
});

test('buildSite marks a preview build as hidden from search engines', async (t) => {
  // Arrange
  const root = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));

  // Act
  await buildSite({ root, preview: true });

  // Assert
  assert.equal(await readFile(join(root, 'dist/robots.txt'), 'utf8'), 'User-agent: *\nDisallow: /\n');
  assert.match(await readFile(join(root, 'dist/_headers'), 'utf8'), /X-Robots-Tag: noindex/);
});

test('buildSite replaces the previous build, so a deleted page does not linger', async (t) => {
  // Arrange
  const root = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'dist'), { recursive: true });
  await writeFile(join(root, 'dist/stale.html'), 'old');

  // Act
  await buildSite({ root });

  // Assert
  assert.ok(!(await readdir(join(root, 'dist'))).includes('stale.html'));
});

test('readBuiltSite lists every built file and returns the HTML of the pages', async (t) => {
  // Arrange
  const root = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await buildSite({ root });

  // Act
  const built = await readBuiltSite(root);

  // Assert
  assert.ok(built.files.has('images/a.png'));
  assert.ok(built.files.has('fonts/outfit.woff2'));
  assert.deepEqual(Object.keys(built.html).sort(), ['about.html', 'index.html']);
});

test('buildSite names the available themes when site.json asks for one that does not exist', async (t) => {
  // Arrange
  const root = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const config = JSON.parse(await readFile(join(root, 'site.json'), 'utf8'));
  await writeFile(join(root, 'site.json'), JSON.stringify({ ...config, theme: 'no-such-theme' }));

  // Act
  const build = buildSite({ root });

  // Assert
  await assert.rejects(build, /There is no theme called "no-such-theme". Themes: .*sea-girt/);
});

test('buildSite lets a theme layout include the site\'s own partials', async (t) => {
  // Arrange
  const root = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const themes = join(root, 'themes');
  await mkdir(join(themes, 'plain'), { recursive: true });
  await writeFile(join(themes, 'plain/layout.html'), '<main>{{body}}</main><footer>{{> footer}}</footer>');
  await writeFile(join(themes, 'plain/plain.css'), 'body{}');
  await writeFile(join(root, 'content/partials/footer.html'), '<p>1105 Wilson Street</p>');
  const config = JSON.parse(await readFile(join(root, 'site.json'), 'utf8'));
  await writeFile(join(root, 'site.json'), JSON.stringify({ ...config, theme: 'plain' }));

  // Act
  await buildSite({ root, themes });

  // Assert
  assert.equal(await readFile(join(root, 'dist/about.html'), 'utf8'), '<main><h1>About</h1><img src="/images/a.png" alt=""></main><footer><p>1105 Wilson Street</p></footer>');
  assert.ok((await readdir(join(root, 'dist'))).includes('plain.css'));
});

test('buildSite writes a trailing-slash page as an index.html in its own folder', async (t) => {
  // Arrange
  const root = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const config = JSON.parse(await readFile(join(root, 'site.json'), 'utf8'));
  config.pages.push({ path: '/blog/page/2/', title: 'Blog', file: 'blog-2.html', description: 'Older posts.' });
  await writeFile(join(root, 'site.json'), JSON.stringify(config));
  await writeFile(join(root, 'content/pages/blog-2.html'), '<h1>Older posts</h1>');

  // Act
  await buildSite({ root });
  const built = await readBuiltSite(root);

  // Assert
  assert.match(built.html['blog/page/2/index.html'], /<h1>Older posts<\/h1>/);
  assert.match(built.html['blog/page/2/index.html'], /<link rel="canonical" href="https:\/\/www\.example\.com\/blog\/page\/2\/">/);
  assert.ok(built.files.has('about.html'), 'a path without a slash still builds a flat file');
  assert.match(await readFile(join(root, 'dist/sitemap.xml'), 'utf8'), /<loc>https:\/\/www\.example\.com\/blog\/page\/2\/<\/loc>/);
});

test('themesDir turns the module address into a real folder path, spaces and Windows drives included', () => {
  // Arrange
  const mac = 'file:///Users/Scott%20Rower/Sites/maryrower/node_modules/practice-site-kit/dist/build.js';
  const windows = 'file:///C:/Users/Scott%20Rower/Sites/maryrower/node_modules/practice-site-kit/dist/build.js';

  // Act
  const macDir = themesDir(mac, false);
  const windowsDir = themesDir(windows, true);

  // Assert
  assert.equal(macDir, '/Users/Scott Rower/Sites/maryrower/node_modules/practice-site-kit/themes/');
  assert.equal(windowsDir, 'C:\\Users\\Scott Rower\\Sites\\maryrower\\node_modules\\practice-site-kit\\themes\\');
});
