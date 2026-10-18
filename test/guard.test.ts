import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changedProtected, classifyChanges, unsavedFiles } from '../src/guard.ts';

test('classifyChanges allows content, images and the settings file, and blocks everything else', () => {
  // Arrange
  const paths = ['content/pages/about.html', 'public/images/mary.jpg', 'site.json', 'wrangler.jsonc', 'package.json', '.claude/settings.json', 'CLAUDE.md', 'archive/snapshot/html/index.html', 'public/styles.css', 'contents/x.html'];

  // Act
  const result = classifyChanges(paths);

  // Assert
  assert.deepEqual(result.allowed, ['content/pages/about.html', 'public/images/mary.jpg', 'site.json']);
  assert.deepEqual(result.blocked, ['wrangler.jsonc', 'package.json', '.claude/settings.json', 'CLAUDE.md', 'archive/snapshot/html/index.html', 'public/styles.css', 'contents/x.html']);
});

test('changedProtected lists changed, added and removed facts and a changed web address', () => {
  // Arrange
  const before = { origin: 'https://www.maryrower.com', facts: { phone: '(732) 359-7676', fax: '(732) 359-7674', address: '2164 Highway 35' } };
  const after = { origin: 'https://maryrower.example', facts: { phone: '(732) 555-0100', address: '2164 Highway 35', email: 'mary@example.com' } };

  // Act
  const changes = changedProtected(before, after);

  // Assert
  assert.deepEqual(changes, [
    'web address: https://www.maryrower.com → https://maryrower.example',
    'phone: (732) 359-7676 → (732) 555-0100',
    'fax: (732) 359-7674 → (removed)',
    'email: (none) → mary@example.com',
  ]);
});

test('changedProtected is empty when only unprotected settings changed', () => {
  // Arrange
  const before = { origin: 'https://www.maryrower.com', facts: { phone: '(732) 359-7676' } };
  const after = { origin: 'https://www.maryrower.com', facts: { phone: '(732) 359-7676' } };

  // Act
  const changes = changedProtected(before, after);

  // Assert
  assert.deepEqual(changes, []);
});

test('changedProtected treats a theme switch as protected', () => {
  // Arrange
  const before = { origin: 'https://www.example.com', theme: 'sea-girt', facts: {} };
  const after = { origin: 'https://www.example.com', theme: 'hood-river', facts: {} };

  // Act
  const changes = changedProtected(before, after);

  // Assert
  assert.deepEqual(changes, ['theme: sea-girt → hood-river']);
});

test('unsavedFiles lists every changed, new or deleted file from git status --porcelain', () => {
  // Arrange
  const porcelain = ' M content/pages/about.html\n?? public/images/new.jpg\n D content/pages/old.html\nR  content/pages/a.html -> content/pages/b.html\n';

  // Act
  const files = unsavedFiles(porcelain);

  // Assert
  assert.deepEqual(files, ['content/pages/about.html', 'public/images/new.jpg', 'content/pages/old.html', 'content/pages/b.html']);
});

test('unsavedFiles is empty when everything is saved', () => {
  // Arrange
  const porcelain = '';

  // Act
  const files = unsavedFiles(porcelain);

  // Assert
  assert.deepEqual(files, []);
});
