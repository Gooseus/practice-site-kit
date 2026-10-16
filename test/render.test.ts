import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyIncludes, escapeHtml, outputPath, renderHeaders, renderNav, renderPage, renderRedirects, renderRobots, renderSitemap, type NavItem, type Page } from '../src/render.ts';

const NAV: NavItem[] = [
  { label: 'Couples Consultation Group', href: '/' },
  { label: 'Therapy', href: '/problems-treated', children: [{ label: 'Problems Treated', href: '/problems-treated' }, { label: 'EMDR for Trauma', href: '/emdr-therapy' }] },
  { label: 'About', href: '/about' },
];
const PAGE: Page = { path: '/about', title: 'About', description: 'Mary "the nurse" & therapist', file: 'about.html' };
const LAYOUT = '<title>{{title}}</title><meta name="description" content="{{description}}">{{indexing}}<body class="page-{{slug}}"><a>{{siteName}}</a><nav>{{nav}}</nav><main>{{body}}</main></body>';

test('escapeHtml escapes the five HTML-significant characters', () => {
  // Arrange
  const raw = `<a href="x">Tom & Jerry's</a>`;

  // Act
  const escaped = escapeHtml(raw);

  // Assert
  assert.equal(escaped, '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;');
});

test('outputPath writes the root to index.html and other pages to a flat .html file', () => {
  // Arrange
  const paths = ['/', '/about', '/emdr-therapy'];

  // Act
  const files = paths.map(outputPath);

  // Assert
  assert.deepEqual(files, ['index.html', 'about.html', 'emdr-therapy.html']);
});

test('renderNav marks only the current page and nests folder children', () => {
  // Arrange
  const current = '/emdr-therapy';

  // Act
  const html = renderNav(NAV, current);

  // Assert
  assert.equal(html.match(/aria-current="page"/g)?.length, 1);
  assert.match(html, /<a href="\/emdr-therapy" aria-current="page">EMDR for Trauma<\/a>/);
  assert.match(html, /<li class="has-menu"><a href="\/problems-treated">Therapy<\/a><ul>/);
});

test('renderPage sets the title, escaped description, canonical URL and body class', () => {
  // Arrange
  const body = '<h1>About</h1>';

  // Act
  const html = renderPage(PAGE, body, { siteName: 'Mary Rower, RN, LCSW', origin: 'https://www.maryrower.com', nav: NAV }, LAYOUT);

  // Assert
  assert.match(html, /<title>About — Mary Rower, RN, LCSW<\/title>/);
  assert.match(html, /<meta name="description" content="Mary &quot;the nurse&quot; &amp; therapist">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/www\.maryrower\.com\/about">/);
  assert.match(html, /<body class="page-about">/);
  assert.ok(html.includes(body));
});

test('renderPage uses the bare site name as the home title and a root canonical', () => {
  // Arrange
  const home: Page = { path: '/', title: 'Couples Consultation Group', description: 'd', file: 'home.html' };

  // Act
  const html = renderPage(home, '', { siteName: 'Mary Rower, RN, LCSW', origin: 'https://www.maryrower.com', nav: NAV }, LAYOUT);

  // Assert
  assert.match(html, /<title>Mary Rower, RN, LCSW<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/www\.maryrower\.com\/">/);
  assert.match(html, /<body class="page-home">/);
});

test('renderPage marks noindex pages and leaves them without a canonical link', () => {
  // Arrange
  const thanks: Page = { path: '/thank-you', title: 'Thank you', description: 'd', file: 'thank-you.html', noindex: true };

  // Act
  const html = renderPage(thanks, '', { siteName: 'S', origin: 'https://www.maryrower.com', nav: NAV }, LAYOUT);

  // Assert
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.doesNotMatch(html, /rel="canonical"/);
});

test('renderRedirects emits one permanent redirect per line', () => {
  // Arrange
  const redirects = { '/services': '/problems-treated', '/new-page-2': '/imago-therapy' };

  // Act
  const file = renderRedirects(redirects);

  // Assert
  assert.equal(file, '/services /problems-treated 301\n/new-page-2 /imago-therapy 301\n');
});

test('applyIncludes substitutes named partials and rejects unknown ones', () => {
  // Arrange
  const body = '<h1>Contact</h1>{{> contact-form}}';
  const partials = { 'contact-form': '<form></form>' };

  // Act
  const html = applyIncludes(body, partials);

  // Assert
  assert.equal(html, '<h1>Contact</h1><form></form>');
  assert.throws(() => applyIncludes('{{> missing}}', partials), /Unknown partial: missing/);
});

test('renderSitemap lists indexable pages only', () => {
  // Arrange
  const pages: Page[] = [PAGE, { path: '/thank-you', title: 'T', description: 'd', file: 't.html', noindex: true }];

  // Act
  const xml = renderSitemap(pages, 'https://www.maryrower.com');

  // Assert
  assert.match(xml, /<loc>https:\/\/www\.maryrower\.com\/about<\/loc>/);
  assert.doesNotMatch(xml, /thank-you/);
});

test('renderRobots allows crawling and points at the sitemap on the real site', () => {
  // Arrange
  const origin = 'https://www.maryrower.com';

  // Act
  const robots = renderRobots(origin, false);

  // Assert
  assert.equal(robots, 'User-agent: *\nAllow: /\n\nSitemap: https://www.maryrower.com/sitemap.xml\n');
});

test('renderRobots blocks all crawling on a preview build', () => {
  // Arrange
  const origin = 'https://www.maryrower.com';

  // Act
  const robots = renderRobots(origin, true);

  // Assert
  assert.equal(robots, 'User-agent: *\nDisallow: /\n');
});

test('renderHeaders adds a noindex header to every path on a preview build only', () => {
  // Arrange
  const builds = [true, false];

  // Act
  const [preview, production] = builds.map(renderHeaders);

  // Assert
  assert.equal(preview, '/*\n  X-Robots-Tag: noindex, nofollow\n');
  assert.equal(production, '');
});

test('renderPage fills the theme layout and leaves the page body untouched', () => {
  // Arrange
  const body = '<p>Literal {{title}} in the copy</p>';

  // Act
  const html = renderPage(PAGE, body, { siteName: 'A & B', origin: 'https://www.example.com', nav: [] }, '<header>{{siteName}}</header>{{nav}}{{body}}');

  // Assert
  assert.equal(html, '<header>A &amp; B</header><ul></ul><p>Literal {{title}} in the copy</p>');
});

test('renderPage rejects a layout placeholder it does not know', () => {
  // Arrange
  const layout = '<h1>{{tagline}}</h1>{{body}}';

  // Act
  const render = () => renderPage(PAGE, '', { siteName: 'S', origin: 'https://www.example.com', nav: [] }, layout);

  // Assert
  assert.throws(render, /Unknown layout placeholder: tagline/);
});

test('outputPath writes a path ending in a slash to an index.html in its own folder', () => {
  // Arrange
  const paths = ['/about/', '/blog/page/2/', '/about', '/'];

  // Act
  const files = paths.map(outputPath);

  // Assert
  assert.deepEqual(files, ['about/index.html', 'blog/page/2/index.html', 'about.html', 'index.html']);
});

test('renderNav marks the current page when paths end in a slash', () => {
  // Arrange
  const nav: NavItem[] = [{ label: 'Home', href: '/' }, { label: 'About', href: '/about/' }, { label: 'Blog', href: '/blog/' }];

  // Act
  const html = renderNav(nav, '/about/');

  // Assert
  assert.equal(html.match(/aria-current="page"/g)?.length, 1);
  assert.match(html, /<a href="\/about\/" aria-current="page">About<\/a>/);
});

test('renderNav renders a folder without an address as a link with no href', () => {
  // Arrange
  const nav: NavItem[] = [{ label: 'Specialties', children: [{ label: 'Anxiety', href: '/therapy-for-anxiety/' }] }];

  // Act
  const html = renderNav(nav, '/therapy-for-anxiety/');

  // Assert
  assert.equal(html, '<ul><li class="has-menu"><a>Specialties</a><ul><li><a href="/therapy-for-anxiety/" aria-current="page">Anxiety</a></li></ul></li></ul>');
});

test('renderPage keeps the trailing slash in the canonical URL and drops it from the body class', () => {
  // Arrange
  const pages: Page[] = [
    { path: '/about/', title: 'About', description: 'd', file: 'about.html' },
    { path: '/blog/page/2/', title: 'Blog', description: 'd', file: 'blog-page-2.html' },
  ];

  // Act
  const [about, blog2] = pages.map((page) => renderPage(page, '', { siteName: 'S', origin: 'https://scottrowerphd.com', nav: [] }, LAYOUT));

  // Assert
  assert.match(about, /<link rel="canonical" href="https:\/\/scottrowerphd\.com\/about\/">/);
  assert.match(about, /<body class="page-about">/);
  assert.match(blog2, /<link rel="canonical" href="https:\/\/scottrowerphd\.com\/blog\/page\/2\/">/);
  assert.match(blog2, /<body class="page-blog-page-2">/);
});

test('renderSitemap lists trailing-slash pages at their exact address', () => {
  // Arrange
  const pages: Page[] = [{ path: '/', title: 'H', description: 'd', file: 'h.html' }, { path: '/about/', title: 'A', description: 'd', file: 'a.html' }];

  // Act
  const xml = renderSitemap(pages, 'https://scottrowerphd.com');

  // Assert
  assert.match(xml, /<loc>https:\/\/scottrowerphd\.com\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/scottrowerphd\.com\/about\/<\/loc>/);
});

test('renderPage fills {{descriptionTag}} with a description meta tag, or with nothing when the page has none', () => {
  // Arrange
  const layout = '<head>{{descriptionTag}}</head>';
  const described: Page = { path: '/about/', title: 'About', description: 'Scott "the psychologist" & more', file: 'about.html' };
  const bare: Page = { path: '/about/', title: 'About', file: 'about.html' };
  const site = { siteName: 'S', origin: 'https://scottrowerphd.com', nav: [] };

  // Act
  const [withTag, withoutTag] = [described, bare].map((page) => renderPage(page, '', site, layout));

  // Assert
  assert.equal(withTag, '<head><meta name="description" content="Scott &quot;the psychologist&quot; &amp; more"></head>');
  assert.equal(withoutTag, '<head></head>');
});
