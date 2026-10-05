import { editorAssetURL } from '../../lib/editor-performance.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fitForTop } from '../../lib/reel-fit.js';
import { lengthOf, liftOf } from '../../lib/garment-scale.js';
import { LIGHT, FABRIC, FIT } from '../../lib/reel-geom.js';

import { lightingFor } from '../../lib/reel-lighting.js';

for (const [type, scale, y, turn, x = 0, z = 0] of [
  ['Polo Sweatshirt', 1.03, -11, 0, 0, 1], ['Oversized Hoodie', 1.05, -4, 0],
  ['Oversized Sweatshirt', 1.03, -11, 0, 0, 2], ['Baby Tee', 1.07, -5, 0],
  ['Henley Waffle Tee', .96, -12, 0, 1, 2], ['Oversized Tee', .90, -9, 180, 0, 2],
  ['Acid Wash Tee', .90, -9, 180, 0, 2],
]) test(`${type} uses the supplied fit`, () => {
  assert.deepEqual(fitForTop(type), { topScale: scale, topY: y, topX: x, topZ: z, topTurn: turn });
});

test('unlisted types stay neutral and manual edits cannot mutate presets', () => {
  assert.deepEqual(fitForTop('Layered Tee'), fitForTop());
  const first = fitForTop('Oversized Hoodie'); first.topScale = 2; first.topZ = 20;
  assert.equal(fitForTop('  OVERSIZED HOODIE ').topScale, 1.05);
  assert.equal(fitForTop('Oversized Hoodie').topZ, 0);
});

class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
  set(x, y, z) { Object.assign(this, { x, y, z }); return this; }
  copy(v) { return this.set(v.x, v.y, v.z); }
}
class Object3D {
  position = new Vector3(); rotation = { y: 0 }; scale = { setScalar: value => { this.scalar = value; } };
  add() {}
}
class Box3 {
  setFromObject() { return this; }
  getSize(v) { return v.set(40, 60, 20); }
  getCenter(v) { return v.set(0, 0, 0); }
}
const context = vm.createContext({ editorAssetURL, THREE: { Vector3, Object3D, Box3 }, LIGHT, FABRIC, FIT, lightingFor, lengthOf, liftOf, Math });
const source = readFileSync(new URL('../../lib/stage3d.js', import.meta.url), 'utf8');
vm.runInContext(source.replace(/^import .*;$/gm, '').replace(/^export /gm, '') + '\nglobalThis.Stage = OutfitStage; globalThis.models = cache;', context);
context.models.set('model', Promise.resolve({ clone: () => ({ position: new Vector3(), traverse() {} }) }));
async function stage(tune) {
  const s = Object.create(context.Stage.prototype);
  Object.assign(s, { tune, parts: {}, outfit: new Object3D(), box: { x: 0, y: 0, w: 800, h: 1600 }, frameH: 1920, hemPx: 2000, camera: { position: new Vector3(), lookAt() {}, updateProjectionMatrix() {} }, key: { shadow: { camera: { updateProjectionMatrix() {} } } } });
  await s.add('top', 'model', 'Oversized Tee'); await s.add('bottom', 'model', 'Loose-Fit Sweatpants');
  s.layout(); return s;
}

test('top translation and 180-degree correction leave bottoms and entry motion intact', async () => {
  const baseline = await stage(fitForTop());
  const moved = await stage({ ...fitForTop(), topX: 8, topZ: 12, topY: -9, topTurn: 180 });
  assert.equal(moved.parts.top.pivot.rotation.y, Math.PI);
  assert.equal(moved.parts.bottom.pivot.rotation.y, 0);
  assert.deepEqual(moved.home.bottom, baseline.home.bottom);
  assert.equal(moved.home.top.x - baseline.home.top.x, 8);
  assert.equal(moved.home.top.y - baseline.home.top.y, -9);
  assert.equal(moved.home.top.z - baseline.home.top.z, 12);
  for (const progress of [0, .2, .5, 1]) {
    moved.setEntry(progress); baseline.setEntry(progress);
    assert.deepEqual(moved.parts.bottom.pivot.position, baseline.parts.bottom.pivot.position);
    assert.equal(moved.parts.top.pivot.position.x, moved.home.top.x);
    assert.equal(moved.parts.top.pivot.position.z, moved.home.top.z);
    assert.equal(moved.parts.top.pivot.position.y - moved.home.top.y, baseline.parts.top.pivot.position.y - baseline.home.top.y);
  }
});

test('repeated previews do not change cached garment materials', async () => {
  const texture = { isTexture: true, anisotropy: 1 };
  const material = { map: texture, roughness: .2, envMapIntensity: 1, clone() { return { ...this, dispose() {} }; } };
  const copies = [];
  context.models.set('material-model', Promise.resolve({ clone() {
    const mesh = { isMesh: true, material };
    copies.push(mesh);
    return { position: new Vector3(), traverse(fn) { fn(mesh); } };
  } }));
  for (let i = 0; i < 3; i++) {
    const s = Object.create(context.Stage.prototype);
    Object.assign(s, { tune: fitForTop(), light: lightingFor('original'), parts: {}, outfit: new Object3D(), materials: new Set(), renderer: { capabilities: { getMaxAnisotropy: () => 16 } } });
    await s.add('top', 'material-model', 'Oversized Tee');
  }
  assert.equal(material.roughness, .2, 'cached source stays authored');
  assert.equal(material.envMapIntensity, 1);
  assert.equal(texture.anisotropy, 16);
  for (const mesh of copies) {
    assert.notEqual(mesh.material, material);
    assert.equal(mesh.material.roughness, .5);
  }
});


test('preview texture resizing leaves full-quality cached images untouched', () => {
  context.THREE.Source = class { constructor(data) { this.data = data; } };
  context.OffscreenCanvas = class {
    constructor(width, height) { Object.assign(this, { width, height }); }
    getContext() { return { drawImage() {} }; }
  };
  class Texture {
    constructor(source) { this.source = source; }
    get image() { return this.source.data; }
    set image(value) { this.source.data = value; }
    clone() { return new Texture(this.source); }
  }
  const original = new Texture(new context.THREE.Source({ width: 2048, height: 1024 }));
  const s = Object.create(context.Stage.prototype); s.textures = new Map();
  const preview = s.previewTexture(original);
  assert.equal(preview.image.width, 512);
  assert.equal(preview.image.height, 256);
  assert.equal(original.image.width, 2048);
  assert.notEqual(preview.source, original.source);
  assert.equal(s.previewTexture(original), preview);
});

test('a rejected model request can be retried', async () => {
  let calls = 0;
  context.GLTFLoader = class {
    setDRACOLoader() {}
    async loadAsync() { if (++calls === 1) throw new Error('offline'); return { scene: 'loaded' }; }
  };
  context.DRACOLoader = class { setDecoderPath() {} };
  await assert.rejects(vm.runInContext("loadModel('retry.glb')", context), /offline/);
  assert.equal(await vm.runInContext("loadModel('retry.glb')", context), 'loaded');
  assert.equal(calls, 2);
});
