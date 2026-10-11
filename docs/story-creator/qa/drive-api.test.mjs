import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDriveApi, ROOT_NAME } from '../../../stories/drive-api.js';

const product = { id: 'gid://shopify/Product/42', title: 'New Tenzen Hoodie', sku: 'TN0042' };
const folder = id => ({ id, name: id, mimeType: 'application/vnd.google-apps.folder' });
const oldFile = name => ({ name: `story-1-${name}-12m.webp`, mimeType: 'image/webp' });
const parentIds = query => [...query.matchAll(/'([^']+)' in parents/g)].map(match => match[1]);

test('new SKU creates one root and one named folder, then uploads a WebP there', async () => {
  const calls = [];
  const send = async (url, options) => {
    calls.push({ url: String(url), options });
    if (url.includes('/about?')) return Response.json({ user: { emailAddress: 'team@tenzen.in' } });
    if (url.includes('/files?') && options.method !== 'POST') return Response.json({ files: [] });
    if (url.includes('uploadType=multipart')) return Response.json({ id: 'webp1', name: 'story.webp' });
    const metadata = JSON.parse(options.body);
    return Response.json({ id: metadata.name === ROOT_NAME ? 'root1' : 'product1', name: metadata.name });
  };
  const drive = createDriveApi('memory-token', send);
  assert.equal(await drive.account(), 'team@tenzen.in');
  assert.equal(await drive.productFolder(product), 'product1');
  await drive.upload('product1', { name: 'story.webp', username: 'reviewer_42', blob: new Blob(['webp'], { type: 'image/webp' }) }, product);
  const created = calls.filter(call => call.options.method === 'POST' && !call.url.includes('/upload/'));
  assert.deepEqual(created.map(call => JSON.parse(call.options.body).name), [ROOT_NAME, product.title]);
  assert.deepEqual(JSON.parse(created[1].options.body).properties, { shopifyProductId: product.id });
  const upload = calls.find(call => call.url.includes('uploadType=multipart'));
  assert.equal(upload.options.headers.Authorization, 'Bearer memory-token');
  const body = await upload.options.body.text();
  assert.match(body, /"parents":\["product1"\]/);
  assert.match(body, /"shopifyProductId":"gid:\/\/shopify\/Product\/42"/);
  assert.match(body, /"sku":"TN0042"/);
  assert.match(body, /"instagramUsername":"reviewer_42"/);
  assert.match(upload.options.headers['Content-Type'], /^multipart\/related; boundary=/);
});

test('same Shopify product ID reuses its folder after title changes', async () => {
  const writes = [];
  const send = async (url, options) => {
    if (options.method === 'PATCH') { writes.push({ url, body: JSON.parse(options.body) }); return Response.json({ id: 'old', name: product.title }); }
    if (options.method === 'POST') throw Error('Created duplicate folder');
    if (url.includes('/about?')) return Response.json({ user: { emailAddress: 'team@tenzen.in' } });
    const q = new URL(url).searchParams.get('q');
    return Response.json({ files: q.includes("'root' in parents")
      ? [{ id: 'root1', name: ROOT_NAME }]
      : [{ id: 'old', name: 'Old product title', properties: { shopifyProductId: product.id } }] });
  };
  assert.equal(await createDriveApi('token', send).productFolder(product), 'old');
  assert.deepEqual(writes.map(write => write.body.name), [product.title]);
});

test('different Google account is rejected before any folder write', async () => {
  const drive = createDriveApi('token', async url => {
    assert.match(url, /\/about\?/);
    return Response.json({ user: { emailAddress: 'other@example.com' } });
  });
  await assert.rejects(drive.account(), /Choose team@tenzen\.in/);
});

test('global scan excludes 25 usernames across five SKUs, nested folders and pages', async () => {
  const names = Array.from({ length: 25 }, (_, i) => `reviewer_${i + 1}`);
  const calls = [];
  const send = async (url, options) => {
    assert.equal(options.method, undefined, 'scan must not write');
    const p = new URL(url).searchParams, q = p.get('q');
    calls.push(q);
    assert.match(q, /trashed = false/);
    if (q.includes("'root' in parents")) return Response.json({ files: [folder('reviews')] });
    if (q.includes("'reviews' in parents")) return Response.json(p.get('pageToken')
      ? { files: [folder('sku4'), folder('sku5')] }
      : { files: [folder('sku1'), folder('sku2'), folder('sku3')], nextPageToken: 'more-folders' });
    if (q.includes("'nested' in parents")) return Response.json({ files: [oldFile(names[0]), { name: 'notes.txt' }] });
    const groups = parentIds(q).map(id => {
      const i = Number(/^sku(\d)$/.exec(id)?.[1]);
      assert.ok(i >= 1 && i <= 5);
      return names.slice((i - 1) * 5, i * 5);
    });
    if (p.get('pageToken')) return Response.json({ files: groups.flatMap(group => group.slice(3)).map(name => ({ name: 'review.webp', mimeType: 'image/webp', properties: { instagramUsername: name.toUpperCase() } })) });
    return Response.json({ files: [...groups.flatMap(group => group.slice(0, 3).map(oldFile)), ...(parentIds(q).includes('sku1') ? [folder('nested')] : [])], nextPageToken: 'more-files' });
  };
  const result = await createDriveApi('token', send).savedUsernames();
  assert.equal(result.fileCount, 26);
  assert.deepEqual([...result.usernames].sort(), names.sort());
  assert.equal(calls.length, 6);
});

test('all review roots, empty pages and nested folder cycles are scanned once', async () => {
  const calls = [];
  const send = async url => {
    const params = new URL(url).searchParams, ids = parentIds(params.get('q'));
    const page = params.get('pageToken');
    calls.push({ ids, page });
    if (ids.includes('root')) return Response.json(page
      ? { files: [folder('reviews-b')] }
      : { files: [folder('reviews-a')], nextPageToken: 'second-root' });
    if (ids.includes('reviews-a') || ids.includes('reviews-b')) {
      assert.deepEqual(ids, ['reviews-a', 'reviews-b']);
      if (!page) return Response.json({ files: [folder('sku-a')], nextPageToken: 'empty-page' });
      if (page === 'empty-page') return Response.json({ files: [], nextPageToken: 'last-children' });
      assert.equal(page, 'last-children');
      return Response.json({ files: [folder('sku-b'), oldFile('root_story')] });
    }
    if (ids.includes('sku-a') || ids.includes('sku-b')) {
      assert.deepEqual(ids, ['sku-a', 'sku-b']);
      return Response.json(page
        ? { files: [oldFile('second_story'), folder('reviews-a')] }
        : { files: [oldFile('first_story'), folder('nested')], nextPageToken: 'second-story' });
    }
    assert.deepEqual(ids, ['nested']);
    return Response.json({ files: [oldFile('nested_story'), folder('nested')] });
  };
  const result = await createDriveApi('token', send).savedUsernames();
  assert.equal(result.fileCount, 4);
  assert.deepEqual([...result.usernames].sort(), ['first_story', 'nested_story', 'root_story', 'second_story']);
  assert.equal(calls.length, 8);
});

test('6000 stories across 400 product folders use bounded parallel batches', async () => {
  let requests = 0, active = 0, maxActive = 0;
  const send = async (url, options) => {
    assert.equal(options.method, undefined);
    requests++; active++; maxActive = Math.max(maxActive, active);
    try {
      await new Promise(resolve => setImmediate(resolve));
      const params = new URL(url).searchParams, ids = parentIds(params.get('q'));
      assert.ok(ids.length <= 20, 'each query must bound the number of parent IDs');
      assert.equal(params.get('pageSize'), '1000');
      if (ids.includes('root')) return Response.json({ files: [folder('reviews')] });
      if (ids.includes('reviews')) return Response.json({ files: Array.from({ length: 400 }, (_, i) => folder(`sku${i}`)) });
      return Response.json({ files: ids.flatMap(id => Array.from({ length: 15 }, (_, i) => oldFile(`${id}_reviewer_${i}`))) });
    } finally { active--; }
  };
  const result = await createDriveApi('token', send).savedUsernames();
  assert.equal(result.fileCount, 6000);
  assert.equal(result.usernames.size, 6000);
  assert.equal(requests, 22);
  assert.ok(maxActive > 1 && maxActive <= 3, 'scan must limit concurrent list requests to three');
});

test('a later page failing in one parallel batch rejects the whole scan', async () => {
  let failedPageRequested = false;
  const send = async url => {
    const params = new URL(url).searchParams, ids = parentIds(params.get('q'));
    if (ids.includes('root')) return Response.json({ files: [folder('reviews')] });
    if (ids.includes('reviews')) return Response.json({ files: Array.from({ length: 60 }, (_, i) => folder(`sku${i}`)) });
    if (ids.includes('sku20')) {
      if (!params.get('pageToken')) return Response.json({ files: [oldFile('partial_story')], nextPageToken: 'failed-page' });
      assert.equal(params.get('pageToken'), 'failed-page'); failedPageRequested = true;
      return Response.json({ error: { message: 'Folder unavailable' } }, { status: 403 });
    }
    return Response.json({ files: [oldFile('saved_story')] });
  };
  await assert.rejects(createDriveApi('token', send).savedUsernames(), /Folder unavailable/);
  assert.equal(failedPageRequested, true);
});

for (const stage of ['root', 'descendant']) {
  test(`incomplete ${stage} search rejects instead of returning partial usernames`, async () => {
    const send = async url => {
      const params = new URL(url).searchParams, ids = parentIds(params.get('q'));
      assert.ok(params.get('fields').includes('incompleteSearch'));
      const incomplete = stage === 'root' ? ids.includes('root') : !ids.includes('root');
      if (incomplete && params.get('pageToken')) return Response.json({ files: [], incompleteSearch: true });
      return Response.json({ files: ids.includes('root') ? [folder('reviews')] : [oldFile('partial_story')],
        ...(incomplete ? { nextPageToken: 'incomplete-page' } : {}) });
    };
    await assert.rejects(createDriveApi('token', send).savedUsernames(), /incomplete/i);
  });
}

test('missing review root returns no saved users without creating folders', async () => {
  const calls = [];
  const result = await createDriveApi('token', async (url, options) => {
    calls.push(options.method); return Response.json({ files: [] });
  }).savedUsernames();
  assert.equal(result.fileCount, 0);
  assert.deepEqual(result.usernames, new Set());
  assert.deepEqual(calls, [undefined]);
});

test('failure in any SKU rejects the entire global scan', async () => {
  const send = async url => {
    const q = new URL(url).searchParams.get('q');
    if (q.includes("'root' in parents")) return Response.json({ files: [{ id: 'reviews' }] });
    if (q.includes("'reviews' in parents")) return Response.json({ files: [{ id: 'sku', mimeType: 'application/vnd.google-apps.folder' }] });
    return Response.json({ error: { message: 'Folder unavailable' } }, { status: 403 });
  };
  await assert.rejects(createDriveApi('token', send).savedUsernames(), /Folder unavailable/);
});
