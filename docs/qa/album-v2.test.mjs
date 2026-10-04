import assert from 'node:assert/strict';
import { test } from 'node:test';
import { galleryScene, galleryCardPose, bagEase, GLASS, PRODUCT_ORDER } from '../../lib/album-v2-motion.js';
import { galleryAudio } from '../../lib/album-v2-media.js';

test('V2 preserves the intro, then visits all five products in the approved order', () => {
  assert.deepEqual(PRODUCT_ORDER, [1, 2, 3, 4, 0]);
  assert.equal(galleryScene(10.7, 10.7667).intro, true);
  assert.equal(galleryScene(10.7667, 10.7667).index, 0);
  for (let i = 0; i < 5; i++) {
    const scene = galleryScene(10.7667 + i * 4.6 + 1.3, 10.7667);
    assert.equal(scene.index, i); assert.equal(scene.glass, 1); assert.equal(scene.zoom, 1);
  }
  assert.equal(galleryScene(33.7667, 10.7667).index, 4);
  assert.equal(galleryScene(33.7667, 10.7667).glass, 1);
});
test('the centered glass card occupies about 70 percent of the viewport', () => {
  assert.ok(Math.abs(GLASS.w * GLASS.h - .7052) < 1e-10);
  assert.equal(GLASS.x * 2 + GLASS.w, 1);
  assert.equal(GLASS.y * 2 + GLASS.h, 1);
});
test('each product holds its detail, clicks the CTA, then returns before the swipe', () => {
  assert.equal(galleryScene(1.3).cursor, 0);
  assert.ok(galleryScene(2).press > .99);
  assert.equal(galleryScene(2).split, 0);
  assert.equal(galleryScene(2.7).split, 1);
  assert.equal(galleryScene(3.2).glass, 1);
  assert.equal(galleryScene(4).zoom, 0);
  assert.equal(galleryScene(4).glass, 0);
  assert.ok(galleryScene(4.3).swipe > 0);
});
test('outgoing card drops away and the next card becomes centered without a jump', () => {
  const end = galleryScene(4.6 - 1e-7), next = galleryScene(4.6);
  assert.ok(galleryCardPose(0, end).opacity < 1e-5);
  assert.equal(galleryCardPose(0, next).visible, false);
  const before = galleryCardPose(1, end), after = galleryCardPose(1, next);
  for (const key of ['x', 'y', 'z', 'rotateX', 'rotateZ', 'opacity']) assert.ok(Math.abs(before[key] - after[key]) < 1e-5, key);
});
test('live bag easing is bounded, monotonic and has exact endpoints', () => {
  assert.equal(bagEase(0), 0); assert.equal(bagEase(1), 1);
  let prior = 0;
  for (let i = 0; i <= 100; i++) { const n = bagEase(i / 100); assert.ok(n >= prior && n <= 1); prior = n; }
  assert.ok(bagEase(.5) > .8);
});
test('all exported frames remain finite at either duration and the final card holds', () => {
  for (const duration of [23, 30]) for (let frame = 0; frame <= duration * 60; frame++) {
    const scene = galleryScene(frame / 60, 0, duration);
    for (const n of Object.values(scene)) if (typeof n === 'number') assert.ok(Number.isFinite(n));
    for (let i = 0; i < 5; i++) for (const n of Object.values(galleryCardPose(i, scene))) if (typeof n === 'number') assert.ok(Number.isFinite(n));
  }
  assert.equal(galleryScene(30, 0, 30).glass, 1);
});
const sound = (value, duration) => ({ duration, sampleRate: 48000, numberOfChannels: 1, getChannelData: () => new Float32Array(48000 * duration).fill(value) });
test('intro audio plays once, gallery music begins after the intro and respects volume', () => {
  const intro = { duration: 2, audio: sound(.4, 1) }, music = sound(.2, 1);
  const mixed = galleryAudio(intro, music, 4, { gain: .5 });
  assert.equal(mixed.frames, 192000); assert.equal(mixed.channels, 2);
  assert.ok(Math.abs(mixed.out[0][24000] - .4) < 1e-6);
  assert.equal(mixed.out[0][72000], 0);
  assert.ok(Math.abs(mixed.out[1][120000] - .1) < 1e-6);
  assert.equal(galleryAudio(intro, null, 4, { introSound: false }), null);
  assert.ok(galleryAudio(intro, music, 4, { introEnabled: false }).out[0][24000] > .19);
});
