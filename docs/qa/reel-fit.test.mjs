import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fitForTop } from '../../lib/reel-fit.js';
import { lengthOf, liftOf } from '../../lib/garment-scale.js';
import { LIGHT, FABRIC, FIT } from '../../lib/reel-geom.js';

for (const [type, scale, y, turn] of [
  ['Polo Sweatshirt', 1.03, -9, 0], ['Oversized Hoodie', 1.05, -4, 0],
  ['Oversized Sweatshirt', 1.02, -9, 0], ['Baby Tee', 1.07, -5, 0],
  ['Henley Waffle Tee', .97, -12, 0], ['Oversized Tee', .91, -9, 180],
  ['Acid Wash Tee', .91, -9, 180],
]) test(`${type} uses the supplied fit`, () => {
  assert.deepEqual(fitForTop(type), { topScale: scale, topY: y, topX: 0, topZ: 0, topTurn: turn });
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
const context = vm.createContext({ THREE: { Vector3, Object3D, Box3 }, LIGHT, FABRIC, FIT, lengthOf, liftOf, Math });
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
