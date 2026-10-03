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

test('global scan excludes 25 usernames across five SKUs, nested folders and pages', async () => {
  const names = Array.from({ length: 25 }, (_, i) => `reviewer_${i + 1}`);
  const folder = id => ({ id, name: id, mimeType: 'application/vnd.google-apps.folder' });
  const oldFile = name => ({ name: `story-1-${name}-12m.webp`, mimeType: 'image/webp' });
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
    const i = Number(/'sku(\d)'/.exec(q)?.[1]);
    assert.ok(i >= 1 && i <= 5);
    const group = names.slice((i - 1) * 5, i * 5);
    if (p.get('pageToken')) return Response.json({ files: group.slice(3).map(name => ({ name: 'review.webp', mimeType: 'image/webp', properties: { instagramUsername: name.toUpperCase() } })) });
    return Response.json({ files: [...group.slice(0, 3).map(oldFile), ...(i === 1 ? [folder('nested')] : [])], nextPageToken: 'more-files' });
  };
  const result = await createDriveApi('token', send).savedUsernames();
  assert.equal(result.fileCount, 26);
  assert.deepEqual([...result.usernames].sort(), names.sort());
  assert.equal(calls.length, 14);
});

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
