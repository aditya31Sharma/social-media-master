import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createDriveApi, ROOT_NAME } from '../../../stories/drive-api.js';
import { createProfilePool } from '../../../stories/profile-pool.js';

test('recorded Drive tree excludes all 80 saved users from the 6000-profile pool', async () => {
  const inventory = JSON.parse(await readFile(new URL('../data/drive-inventory-20261011.json', import.meta.url), 'utf8'));
  const users = JSON.parse(await readFile(new URL('../../../stories/profiles/users.json', import.meta.url), 'utf8'));
  const paths = new Map(inventory.folders.map(folder => [JSON.stringify(folder.path), folder.id]));
  const records = [
    ...inventory.folders.map(folder => ({ id: folder.id, name: folder.name,
      mimeType: 'application/vnd.google-apps.folder',
      parent: folder.id === inventory.root_id ? 'root' : paths.get(JSON.stringify(folder.path.slice(0, -1))) })),
    ...inventory.files.map(file => ({ id: file.id, name: file.name, mimeType: 'image/webp', parent: file.parent_id })),
  ];
  assert.equal(inventory.folders.length, 13);
  assert.equal(users.length, 6000);
  assert.ok(records.every(record => record.parent), 'every recorded entry must remain in its original folder');
  const calls = [];
  const send = async (url, options) => {
    assert.equal(options.method, undefined, 'inventory scan must not write to Drive');
    const params = new URL(url).searchParams, query = params.get('q');
    const parents = [...query.matchAll(/'([^']+)' in parents/g)].map(match => match[1]);
    assert.match(query, /trashed = false/);
    assert.equal(params.get('pageToken'), null);
    calls.push(parents);
    const files = records.filter(record => parents.includes(record.parent)
      && (!query.includes('mimeType =') || record.mimeType === 'application/vnd.google-apps.folder')
      && (!query.includes('name =') || record.name === ROOT_NAME));
    return Response.json({ files, incompleteSearch: false });
  };
  const saved = await createDriveApi('fixture-token', send).savedUsernames();
  assert.equal(saved.fileCount, 82);
  assert.equal(saved.usernames.size, 80);
  assert.deepEqual([...saved.usernames].sort(), [...inventory.usernames].sort());
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[0], ['root']);
  assert.deepEqual(calls[1], [inventory.root_id]);
  assert.deepEqual(new Set(calls[2]), new Set(inventory.folders.filter(folder => folder.id !== inventory.root_id).map(folder => folder.id)));

  const allNames = new Set(users.map(user => user.username));
  assert.ok([...saved.usernames].every(name => allNames.has(name)), 'saved legacy profiles must remain in the source data');
  const pool = createProfilePool(users);
  pool.setSavedUsers(saved.usernames);
  assert.equal(pool.remaining, 5920);
  const available = pool.search('', new Set(), '', users.length);
  assert.equal(available.count, 5920);
  assert.equal(available.matches.length, 5920);
  assert.ok(available.matches.every(user => !saved.usernames.has(user.username)));
  for (const username of saved.usernames) {
    assert.equal(pool.find(username), null);
    assert.equal(pool.use(username), null);
    assert.ok(pool.search(`@${username.toUpperCase()}`).matches.every(user => user.username !== username));
  }
  const drawn = new Set();
  while (pool.remaining) {
    const user = pool.draw();
    assert.ok(!saved.usernames.has(user.username));
    assert.ok(!drawn.has(user.username));
    drawn.add(user.username);
  }
  assert.equal(drawn.size, 5920);
  assert.equal(pool.draw(), null);
});
