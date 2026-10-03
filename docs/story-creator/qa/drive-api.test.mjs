import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDriveApi, ROOT_NAME } from '../../../stories/drive-api.js';

const product = { id: 'gid://shopify/Product/42', title: 'New Tenzen Hoodie', sku: 'TN0042' };

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

test('existing product folder excludes 11 saved usernames across Drive pages', async () => {
  const names = Array.from({ length: 11 }, (_, index) => `reviewer_${index + 1}`);
  const calls = [];
  const send = async (url, options) => {
    calls.push({ url: String(url), method: options.method });
    assert.notEqual(options.method, 'POST');
    assert.notEqual(options.method, 'PATCH');
    const params = new URL(url).searchParams;
    const q = params.get('q');
    if (q.includes("'root' in parents")) return Response.json({ files: [{ id: 'root1', name: ROOT_NAME }] });
    if (q.includes("'root1' in parents")) return Response.json({ files: [{ id: 'product1', name: product.title, properties: { shopifyProductId: product.id } }] });
    assert.match(q, /'product1' in parents/);
    if (!params.get('pageToken')) return Response.json({ nextPageToken: 'second', files: [
      ...names.slice(0, 6).map((name, index) => ({ id: `old${index}`, name: `story-${index + 1}-${name}-12m.webp`, mimeType: 'image/webp' })),
      { id: 'other', name: 'notes.txt', mimeType: 'text/plain' },
    ] });
    return Response.json({ files: names.slice(6).map((name, index) => ({ id: `new${index}`, name: 'uploaded.webp', mimeType: 'image/webp', properties: { instagramUsername: name } })) });
  };
  const result = await createDriveApi('token', send).savedUsernames(product);
  assert.equal(result.folderId, 'product1');
  assert.equal(result.fileCount, 11);
  assert.deepEqual([...result.usernames], names);
  assert.equal(calls.length, 4);
});

test('missing product folder returns no saved users without creating folders', async () => {
  const calls = [];
  const send = async (url, options) => {
    calls.push({ url: String(url), method: options.method });
    return Response.json({ files: [] });
  };
  const result = await createDriveApi('token', send).savedUsernames(product);
  assert.deepEqual(result, { folderId: null, fileCount: 0, usernames: new Set() });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, undefined);
});
