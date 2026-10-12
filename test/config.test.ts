import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSiteConfig } from '../src/config.ts';

const valid = () => ({
  siteName: 'Mary Rower, RN, LCSW',
  origin: 'https://www.maryrower.com',
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
      'page "contact": description is missing',
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
