import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSiteConfig } from '../src/config.ts';

const valid = () => ({
  siteName: 'Mary Rower, RN, LCSW',
  origin: 'https://www.maryrower.com',
  theme: 'sea-girt',
  facts: { phone: '(732) 359-7676' },
  nav: [
    { label: 'Home', href: '/' },
    { label: 'Therapy', href: '/about', children: [{ label: 'About', href: '/about' }] },
    { label: 'Book', href: 'https://example.com/book' },
  ],
  pages: [
    { path: '/', title: 'Home', file: 'home.html', description: 'Welcome.' },
    { path: '/about', title: 'About', file: 'about.html', description: 'About Mary.' },
    { path: '/404', title: 'Not found', file: '404.html', description: 'Not found.', noindex: true },
  ],
  redirects: { '/services': '/about' },
});

test('parseSiteConfig returns a valid settings file unchanged, with empty defaults for the optional parts', () => {
  // Arrange
  const full = valid();
  const { facts, redirects, ...minimal } = valid();

  // Act
  const parsedFull = parseSiteConfig(full);
  const parsedMinimal = parseSiteConfig(minimal);

  // Assert
  assert.deepEqual(parsedFull, full);
  assert.deepEqual(parsedMinimal.facts, {});
  assert.deepEqual(parsedMinimal.redirects, {});
});

test('parseSiteConfig reports every problem at once, in plain words', () => {
  // Arrange
  const broken = valid() as any;
  delete broken.siteName;
  broken.origin = 'www.maryrower.com/';
  broken.pages.push({ path: 'contact', title: 'Contact', file: '../secret.html', description: '' });
  broken.pages.push({ path: '/about', title: 'About again', file: 'about2.html', description: 'x' });
  broken.nav.push({ label: 'Gone', href: '/gone' });
  broken.redirects['/about'] = '/';
  broken.redirects['/old'] = '/nowhere';

  // Act
  const act = () => parseSiteConfig(broken);

  // Assert
  assert.throws(act, (err: Error) => {
    for (const expected of [
      'siteName is missing',
      'origin must look like https://www.example.com',
      'page "contact": path must start with /',
      'page "contact": file must be a plain .html file name',
      'page "contact": description is empty; leave it out or write one',
      'page "/about" is listed twice',
      'menu link "Gone" points to /gone, which is not a page',
      'redirect /about is also a page',
      'redirect /old points to /nowhere, which is not a page',
    ]) assert.ok(err.message.includes(expected), `missing: ${expected}\n${err.message}`);
    return true;
  });
});

test('parseSiteConfig rejects something that is not a settings object', () => {
  // Arrange
  const inputs = [null, [], 'site'];

  // Act
  const acts = inputs.map((input) => () => parseSiteConfig(input));

  // Assert
  for (const act of acts) assert.throws(act, /site\.json must be an object/);
});

test('parseSiteConfig requires a theme name made of lowercase letters, digits and dashes', () => {
  // Arrange
  const missing = { ...valid(), theme: undefined };
  const odd = { ...valid(), theme: '../Sea Girt' };

  // Act
  const fail = (input: unknown) => () => parseSiteConfig(input);

  // Assert
  assert.throws(fail(missing), /theme must be a theme name like "sea-girt"/);
  assert.throws(fail(odd), /theme must be a theme name like "sea-girt"/);
});

test('parseSiteConfig accepts page paths that end in a slash, with menu links and redirects to them', () => {
  // Arrange
  const input = {
    ...valid(),
    nav: [{ label: 'Home', href: '/' }, { label: 'About', href: '/about/' }, { label: 'Specialties', children: [{ label: 'Anxiety', href: '/therapy-for-anxiety/' }] }],
    pages: [
      { path: '/', title: 'Home', file: 'home.html', description: 'Welcome.' },
      { path: '/about/', title: 'About', file: 'about.html', description: 'About Scott.' },
      { path: '/therapy-for-anxiety/', title: 'Anxiety', file: 'therapy-for-anxiety.html', description: 'Anxiety.' },
    ],
    redirects: { '/anxiety-is-not-the-enemy-pt2/': '/about/' },
  };

  // Act
  const parsed = parseSiteConfig(input);

  // Assert
  assert.deepEqual(parsed, input);
});

test('parseSiteConfig rejects the same page listed with and without a trailing slash', () => {
  // Arrange
  const input = valid();
  input.pages.push({ path: '/about/', title: 'About', file: 'about-2.html', description: 'Again.' });

  // Act
  const act = () => parseSiteConfig(input);

  // Assert
  assert.throws(act, /page "\/about\/" is the same address as "\/about"/);
});

test('parseSiteConfig lets only a menu folder leave out its address', () => {
  // Arrange
  const folder = { ...valid(), nav: [{ label: 'Therapy', children: [{ label: 'About', href: '/about' }] }] };
  const plain = { ...valid(), nav: [{ label: 'Therapy' }] };

  // Act
  const parse = (input: unknown) => () => parseSiteConfig(input);

  // Assert
  assert.doesNotThrow(parse(folder));
  assert.throws(parse(plain), /every menu link needs a label and an href/);
});

test('parseSiteConfig lets a page leave out its description but not give a blank one', () => {
  // Arrange
  const missing = valid();
  delete (missing.pages[1] as { description?: string }).description;
  const blank = valid();
  blank.pages[1].description = '  ';

  // Act
  const parse = (input: unknown) => () => parseSiteConfig(input);

  // Assert
  assert.doesNotThrow(parse(missing));
  assert.throws(parse(blank), /page "\/about": description is empty; leave it out or write one/);
});
