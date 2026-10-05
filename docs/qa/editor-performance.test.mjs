import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, statSync } from 'node:fs';
import { EDITOR_PREVIEWS } from '../../lib/editor-preview-assets.js';
import { editorAssetURL, editorShutterTimes, schedulePaint } from '../../lib/editor-performance.js';

test('only editing loads use bundled lightweight assets; exports preserve source URLs', () => {
  for (const [source, preview] of Object.entries(EDITOR_PREVIEWS)) {
    const original = new URL(source, new URL('../../lib/editor-performance.js', import.meta.url)).href;
    assert.equal(editorAssetURL(original), original);
    assert.equal(editorAssetURL(original, true), new URL(preview, new URL('../../lib/editor-performance.js', import.meta.url)).href);
    assert.ok(statSync(new URL(preview, new URL('../../lib/editor-performance.js', import.meta.url))).size > 0);
  }
  assert.equal(editorAssetURL('blob:uploaded-glb', true), 'blob:uploaded-glb');
  assert.equal(editorAssetURL('https://example.test/new-product.glb', true), 'https://example.test/new-product.glb');
});

test('all default garments have valid compact GLBs with bounded embedded textures', () => {
  const products = JSON.parse(readFileSync(new URL('../../assets/album-v2/products.json', import.meta.url)));
  for (const product of products) {
    const bytes = readFileSync(editorAssetURL(product.glb, true).replace('file://', ''));
    assert.equal(bytes.readUInt32LE(0), 0x46546c67); assert.equal(bytes.readUInt32LE(8), bytes.length);
    const size = bytes.readUInt32LE(12), doc = JSON.parse(bytes.subarray(20,20+size));
    const binary = bytes.subarray(28+size);
    for (const image of doc.images) {
      const view = doc.bufferViews[image.bufferView], png = binary.subarray(view.byteOffset, view.byteOffset+view.byteLength);
      assert.equal(image.mimeType,'image/png'); assert.ok(png.readUInt32BE(16)<=512); assert.ok(png.readUInt32BE(20)<=512);
    }
    for (const view of doc.bufferViews) assert.ok(view.byteOffset+view.byteLength <= binary.length);
  }
});

test('preview shutter work is bounded while full-quality shutter samples remain untouched', () => {
  const full = [1,.992,.984,.976,.968];
  assert.deepEqual(editorShutterTimes(full,true),[1,.968]);
  assert.equal(editorShutterTimes(full,false),full);
  assert.deepEqual(editorShutterTimes([1],true),[1]);
});

test('rapid editing requests paint once and retain latest changes while an async seek runs', async () => {
  const frames=[], paints=[], pending=[], errors=[]; let state=0;
  const schedule=schedulePaint(()=>{paints.push(state);return new Promise(resolve=>pending.push(resolve))},error=>errors.push(error),callback=>frames.push(callback));
  for(let i=0;i<100;i++){state=i;schedule()}
  assert.equal(frames.length,1);const first=frames.shift()();assert.deepEqual(paints,[99]);
  for(let i=100;i<200;i++){state=i;schedule()}
  assert.equal(frames.length,0);pending.shift()();await first;
  assert.equal(frames.length,1);const second=frames.shift()();assert.deepEqual(paints,[99,199]);pending.shift()();await second;
  assert.equal(frames.length,0);assert.deepEqual(errors,[]);
});

test('a rejected paint does not prevent the next editing frame', async () => {
  const frames=[], errors=[];let count=0;
  const schedule=schedulePaint(async()=>{if(++count===1)throw Error('seek failed')},error=>errors.push(error.message),callback=>frames.push(callback));
  schedule();await frames.shift()();schedule();await frames.shift()();
  assert.equal(count,2);assert.deepEqual(errors,['seek failed']);
});

test('export upgrades bundled previews and retains reordered uploads without disposing user media', async () => {
  const { prepareExportMedia } = await import('../../lib/album-v2-export-media.js');
  const originalFetch=globalThis.fetch, originalBitmap=globalThis.createImageBitmap, requested=[], closed=[];
  globalThis.fetch=async url=>{requested.push(String(url));return {ok:true,blob:async()=>String(url)}};
  globalThis.createImageBitmap=async name=>({name,close(){closed.push(name)}});
  const upload={name:'uploaded',close(){throw Error('must not dispose upload')}}, cutout={image:upload,crop:{x:0,y:0,w:10,h:20}};
  try {
    const models=[{productName:'Reordered B',photos:[{file:'b.webp',preview:true,image:{name:'small B'}},{file:'old.webp',preview:false,image:upload}],people:{woman:cutout}},{productName:'Reordered A',photos:[{file:'a.webp',preview:true,image:{name:'small A'}}]}];
    const prepared=await prepareExportMedia(models,null,false);
    assert.deepEqual(prepared.models.map(model=>model.productName),['Reordered B','Reordered A']);
    assert.equal(prepared.models[0].photos[1].image,upload);assert.equal(prepared.models[0].people.woman,cutout);
    assert.equal(prepared.models[0].image,prepared.models[0].photos[0].image);
    assert.equal(prepared.models[0].photos[0].preview,false);assert.equal(models[0].photos[0].preview,true);
    assert.equal(requested.length,2);assert.ok(requested.every(url=>!url.includes('editor-previews')));
    prepared.dispose();assert.equal(closed.length,2);
  } finally {globalThis.fetch=originalFetch;globalThis.createImageBitmap=originalBitmap}
});

test('a failed full-quality fetch blocks export and releases other completed bitmaps', async () => {
  const { prepareExportMedia } = await import('../../lib/album-v2-export-media.js');
  const originalFetch=globalThis.fetch,originalBitmap=globalThis.createImageBitmap,closed=[];
  globalThis.fetch=async url=>({ok:!String(url).endsWith('missing.webp'),blob:async()=>String(url)});
  globalThis.createImageBitmap=async name=>({close(){closed.push(name)}});
  try {
    const models=['valid.webp','missing.webp'].map(file=>({productName:file,photos:[{file,label:'Shoot',preview:true}]}));
    await assert.rejects(prepareExportMedia(models,null,false),/Could not load missing/);assert.equal(closed.length,1);
  } finally {globalThis.fetch=originalFetch;globalThis.createImageBitmap=originalBitmap}
});
