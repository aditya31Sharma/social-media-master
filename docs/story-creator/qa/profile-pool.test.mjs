import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProfilePool } from '../../../stories/profile-pool.js';

const users = Array.from({ length: 6000 }, (_, i) => ({ username: `user_${i}`, photo: `${i}.jpg` }));

test('blocks all selection until a complete saved-user scan, including after reconnect', () => {
  const pool = createProfilePool(users);
  assert.equal(pool.draw(), null);
  assert.equal(pool.find('user_1'), null);
  assert.equal(pool.search('').count, 0);
  pool.setSavedUsers(new Set());
  assert.equal(pool.remaining, 6000);
  pool.setSavedUsers(null);
  assert.equal(pool.remaining, 0);
  assert.equal(pool.search('').count, 0);
});

test('draws every eligible account once, preserving exclusions and draw history after scans', () => {
  const pool = createProfilePool(users);
  pool.setSavedUsers(new Set([' @USER_0 ', 'user_1']));
  pool.use('USER_2');
  const chosen = new Set(['user_2']);
  while (pool.remaining) {
    const user = pool.draw();
    assert.ok(!chosen.has(user.username));
    assert.ok(!['user_0', 'user_1'].includes(user.username));
    chosen.add(user.username);
  }
  assert.equal(chosen.size, 5998);
  assert.equal(pool.draw(), null);
  pool.setSavedUsers(new Set(['user_0', 'user_1']));
  assert.equal(pool.remaining, 0);
  assert.equal(pool.find('USER_2').username, 'user_2');
});

test('searches all 6000 while limiting options and preserving the current eligible profile', () => {
  const pool = createProfilePool(users);
  pool.setSavedUsers(new Set(['user_0']));
  const reserved = new Set(['user_1', 'user_5999']);
  const result = pool.search('', reserved, 'user_5999');
  assert.equal(result.count, 5998);
  assert.equal(result.matches.length, 100);
  assert.ok(result.matches.some(user => user.username === 'user_5999'));
  assert.ok(!result.matches.some(user => ['user_0', 'user_1'].includes(user.username)));
  assert.equal(pool.find('user_0'), null);
  assert.equal(pool.find('user_1', reserved), null);
  assert.equal(pool.search('@USER_5432').matches[0].username, 'user_5432');
  pool.setSavedUsers(new Set(['user_5999']));
  assert.ok(!pool.search('', reserved, 'user_5999').matches.some(user => user.username === 'user_5999'));
});
