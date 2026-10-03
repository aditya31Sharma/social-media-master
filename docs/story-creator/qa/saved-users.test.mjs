import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeUsername, savedUsername } from '../../../stories/saved-users.js';

test('normalizes usernames for case-insensitive matching', () => {
  assert.equal(normalizeUsername(' @Reviewer_One '), 'reviewer_one');
});

test('reads usernames from earlier story filenames', () => {
  assert.equal(savedUsername({ name: 'story-11-Reviewer.One-5H.webp', mimeType: 'image/webp' }), 'reviewer.one');
  assert.equal(savedUsername({ name: 'story-2-name-with-hyphens-60m.webp' }), 'name-with-hyphens');
});

test('prefers username metadata on new uploads', () => {
  assert.equal(savedUsername({ name: 'uploaded.webp', mimeType: 'image/webp', properties: { instagramUsername: '@Review_User' } }), 'review_user');
});

test('ignores unrelated files without a recognizable username', () => {
  assert.equal(savedUsername({ name: 'story-1-user-12m.jpg', mimeType: 'image/jpeg' }), null);
  assert.equal(savedUsername({ name: 'review.webp', mimeType: 'image/webp' }), null);
});
