import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changedProtected, classifyChanges } from '../src/guard.ts';

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
