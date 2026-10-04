import assert from 'node:assert/strict';
import { test } from 'node:test';
import { galleryScene, galleryCardPose, bagEase, GLASS, BAG, INTRO_DURATION, PRODUCT_ORDER } from '../../lib/album-v2-motion.js';
import { galleryAudio } from '../../lib/album-v2-media.js';
import { introLabels } from '../../lib/album-v2-labels.js';
import { splitTitle } from '../../lib/shopify.js';

test('intro is three seconds and labels appear abruptly at 0.5s before receding with its card', () => {
  assert.equal(INTRO_DURATION, 3);
  assert.equal(galleryScene(.499, 3).labels, false);
  assert.equal(galleryScene(.5, 3).labels, true);
  assert.equal(galleryScene(2.9, 3).labels, true);
  assert.ok(galleryScene(2.15, 3).zoom < 1);
  assert.ok(galleryScene(2.8, 3).swipe > 0);
  assert.equal(galleryCardPose(-1, galleryScene(3, 3)).visible, false);
  assert.equal(galleryScene(3, 3).index, 0);
  const labels = introLabels();
  assert.equal(labels.find(l => l.id === 'heading').text, 'Tenzen Presents');
  assert.equal(labels.find(l => l.id === 'creator').text, 'Tenzen Angels');
  assert.ok(labels.every(l => l.font === 'Geist'));
});
test('each photo is fitted and stays clear for one second before its glass enters', () => {
  assert.deepEqual(PRODUCT_ORDER, [1, 2, 3, 4, 0]);
  for (let i = 0; i < 5; i++) {
    const start = 3 + i * 4.6;
    for (const offset of [.55, 1, 1.549]) {
      const scene = galleryScene(start + offset, 3);
      assert.ok(Math.abs(scene.zoom - 1) < 1e-10); assert.equal(scene.glass, 0);
    }
    assert.ok(galleryScene(start + 1.7, 3).glass > 0);
    assert.equal(galleryScene(start + 1.9, 3).glass, 1);
  }
});
test('glass is full width, attached to the bottom and occupies 60 percent', () => {
  assert.equal(GLASS.w * GLASS.h, .6); assert.equal(GLASS.x, 0);
  assert.equal(GLASS.y + GLASS.h, 1); assert.equal(GLASS.w, 1);
  assert.equal(BAG.width * 390, 348); assert.equal(BAG.x * 390, 21);
  assert.equal(BAG.height * 390, 64); assert.equal(BAG.gap * 390, 8);
});
test('garments turn slowly and the bag splits without a cursor', () => {
  const a = galleryScene(1.9), b = galleryScene(2.9);
  assert.ok(Math.abs(b.turn - a.turn - Math.PI * 2 / 10) < 1e-10);
  assert.equal('cursor' in a, false); assert.equal(a.split, 0);
  assert.ok(galleryScene(2.35).press > .99); assert.equal(galleryScene(3.1).split, 1);
});
test('every outgoing product settles at the rear while its successor becomes centered', () => {
  for (let index = 0; index < 4; index++) {
    const before = galleryScene((index + 1) * 4.6 - 1e-7), after = galleryScene((index + 1) * 4.6 + 1e-7);
    assert.ok(galleryCardPose(index, before).z < -2.9);
    assert.equal(galleryCardPose(index, after).visible, true);
    for (let order = 0; order < 5; order++) {
      const a = galleryCardPose(order, before), b = galleryCardPose(order, after);
      for (const key of ['x', 'y', 'z', 'rotateX', 'rotateZ', 'opacity']) assert.ok(Math.abs(a[key] - b[key]) < 1e-5, `${index}/${order}/${key}`);
    }
  }
});
test('intro handoff has continuous product positions and the final product holds', () => {
  for (let order = 0; order < 5; order++) {
    const before = galleryCardPose(order, galleryScene(3 - 1e-7, 3)), after = galleryCardPose(order, galleryScene(3, 3));
    for (const key of ['x', 'y', 'z', 'rotateX']) assert.ok(Math.abs(before[key] - after[key]) < 1e-5);
  }
  assert.equal(galleryScene(26, 3).glass, 1); assert.equal(galleryScene(26, 3).index, 4);
});
test('product names use the same split as the carousel', () => {
  assert.deepEqual(splitTitle('Victor Doom Polo Sweatshirt Olive', 'Polo Sweatshirt'), ['Victor Doom', 'Polo Sweatshirt Olive']);
  assert.deepEqual(splitTitle('Stand Unshaken Oversized Hoodie Acid Black', 'Oversized Hoodie'), ['Stand Unshaken', 'Oversized Hoodie Acid Black']);
});
test('live bag easing is bounded and monotonic', () => {
  assert.equal(bagEase(0), 0); assert.equal(bagEase(1), 1); let prior = 0;
  for (let i = 0; i <= 100; i++) { const n = bagEase(i / 100); assert.ok(n >= prior && n <= 1); prior = n; }
});
test('all frame poses remain finite with and without intro at either gallery duration', () => {
  for (const intro of [0, 3]) for (const duration of [23, 30]) for (let frame = 0; frame <= (intro + duration) * 60; frame++) {
    const scene = galleryScene(frame / 60, intro, duration);
    for (const n of Object.values(scene)) if (typeof n === 'number') assert.ok(Number.isFinite(n));
    for (let i = -1; i < 5; i++) for (const n of Object.values(galleryCardPose(i, scene))) if (typeof n === 'number') assert.ok(Number.isFinite(n));
  }
});
const sound = (value, duration) => ({ duration, sampleRate: 48000, numberOfChannels: 1, getChannelData: () => new Float32Array(48000 * duration).fill(value) });
test('intro audio cuts at three seconds and music begins there, without looping short intros', () => {
  const intro = { duration: 10, audio: sound(.4, 10) }, music = sound(.2, 1);
  const mixed = galleryAudio(intro, music, 5, { gain: .5 });
  assert.ok(Math.abs(mixed.out[0][120000] - .4) < 1e-6);
  assert.ok(Math.abs(mixed.out[1][168000] - .1) < 1e-6);
  assert.equal(galleryAudio({ duration: 1, audio: sound(.4, 1) }, null, 5).out[0][72000], 0);
  assert.equal(galleryAudio(intro, null, 5, { introSound: false }), null);
  assert.ok(galleryAudio(intro, music, 5, { introEnabled: false }).out[0][24000] > .19);
});
