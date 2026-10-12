import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkFacts, checkImages, checkLinks, targetFile } from '../src/checks.ts';

test('targetFile maps site paths to built files and ignores everything off-site', () => {
  // Arrange
  const refs = ['/', '/about', '/about/', '/about?x=1#team', '/images/a.png', 'team.html', '#top', 'mailto:a@b.co', 'tel:+1732', 'https://example.com/', '//cdn.example.com/x.js', 'data:image/png;base64,AA'];

  // Act
  const out = refs.map((ref) => targetFile(ref, 'therapy/emdr.html'));

  // Assert
  assert.deepEqual(out, ['index.html', 'about.html', 'about.html', 'about.html', 'images/a.png', 'therapy/team.html', null, null, null, null, null, null]);
});

test('checkLinks passes pages, files and old addresses that redirect', () => {
  // Arrange
  const html = { 'index.html': '<a href="/about">About</a> <a href="/services">Old</a> <img src="/images/a.png" alt=""> <link rel="stylesheet" href="/styles.css">' };
  const files = new Set(['index.html', 'about.html', 'images/a.png', 'styles.css']);

  // Act
  const issues = checkLinks(html, files, { '/services': '/about' });

  // Assert
  assert.deepEqual(issues, []);
});

test('checkLinks names the page and the target for each broken link or missing file', () => {
  // Arrange
  const html = {
    'index.html': '<a href="/abuot">About</a> <img src="/images/gone.jpg" alt="Gone">',
    'about.html': '<a href="/">Home</a> <img srcset="/images/a.png 1x, /images/b.png 2x" alt="">',
  };
  const files = new Set(['index.html', 'about.html', 'images/a.png']);

  // Act
  const issues = checkLinks(html, files, {});

  // Assert
  assert.deepEqual(issues, [
    'index.html: link to /abuot goes nowhere',
    'index.html: link to /images/gone.jpg goes nowhere',
    'about.html: link to /images/b.png goes nowhere',
  ]);
});

test('checkImages flags images with no alt attribute and accepts an empty one', () => {
  // Arrange
  const html = { 'index.html': '<img src="/a.png"> <img src="/b.png" alt=""> <img alt="C" src="/c.png">' };

  // Act
  const issues = checkImages(html);

  // Assert
  assert.deepEqual(issues, ['index.html: image /a.png has no description (alt text)']);
});

test('checkFacts requires every protected fact to appear on at least one page', () => {
  // Arrange
  const html = { 'index.html': '<p>Call <a href="tel:+17323597676">(732) 359-7676</a></p>', 'about.html': '<p>Smith &amp; Jones, Suite 6</p>' };
  const facts = { phone: '(732) 359-7676', firm: 'Smith & Jones', fax: '(732) 359-7674' };

  // Act
  const issues = checkFacts(html, facts);

  // Assert
  assert.deepEqual(issues, ['fax "(732) 359-7674" no longer appears on any page']);
});
