import assert from 'node:assert/strict';
import { test } from 'node:test';
import { galleryScene, galleryCardPose, bagEase, GLASS, BAG, INTRO_DURATION, FIRST_STACK_HOLD, OUTRO_DURATION, PRODUCT_DURATION, GALLERY_DURATION, STACK, photoScene, shutterTimes, PRODUCT_ORDER } from '../../lib/album-v2-motion.js';
import { galleryAudio } from '../../lib/album-v2-media.js';
import { introLabels, introControls } from '../../lib/album-v2-labels.js';
import { splitTitle } from '../../lib/shopify.js';

test('intro is three seconds and labels appear abruptly at 0.5s before receding with its card', () => {
  assert.equal(INTRO_DURATION, 3);
  assert.equal(galleryScene(.499, 3).labels, false);
  assert.equal(galleryScene(.5, 3).labels, true);
  assert.equal(galleryScene(2.9, 3).labels, true);
  assert.ok(galleryScene(2.15, 3).zoom < 1);
  assert.equal(galleryScene(2.8, 3).zoom, 0);
  assert.equal(galleryCardPose(-1, galleryScene(3, 3)).visible, false);
  assert.equal(galleryScene(3, 3).index, 0);
  const labels = introLabels();
  assert.equal(labels.find(l => l.id === 'heading').text, 'Tenzen Presents');
  assert.equal(labels.find(l => l.id === 'creator').text, 'Tenzen Angels');
  assert.ok(labels.every(l => l.font === 'Geist'));
});
test('first stack holds another half-second and glass starts only on the second-last image', () => {
  assert.deepEqual(PRODUCT_ORDER, [1, 2, 3, 4, 0]);
  assert.equal(FIRST_STACK_HOLD, .5);
  assert.equal(galleryScene(3.49, 3).zoom, 0);
  assert.ok(galleryScene(3.8, 3).zoom > 0);
  for (let i = 0; i < 5; i++) {
    const start = 3.5 + i * PRODUCT_DURATION;
    for (const offset of [.7, 2.5, 4.59]) assert.equal(galleryScene(start + offset, 3).glass, 0);
    assert.equal(photoScene(galleryScene(start + 4.8, 3)).to, 2);
    assert.ok(galleryScene(start + 4.8, 3).glass > 0);
    assert.equal(galleryScene(start + 5.1, 3).glass, 1);
  }
});
test('glass floats with 20px margins and 48px corners at 390px design width', () => {
  assert.equal(GLASS.x * 390, 20); assert.equal(GLASS.w * 390, 350);
  assert.ok(Math.abs((1 - GLASS.y - GLASS.h) * 390 * 16 / 9 - 20) < 1e-10);
  assert.equal(GLASS.radius * 390, 48); assert.equal(GLASS.h, .6);
  assert.equal(BAG.height * 390, 64); assert.equal(BAG.gap * 390, 8);
});
test('garments turn slowly and the bag splits without a cursor', () => {
  const a = galleryScene(5.7), b = galleryScene(6.7);
  assert.ok(Math.abs(b.turn - a.turn - Math.PI * 2 / 10) < 1e-10);
  assert.equal('cursor' in a, false); assert.equal(a.split, 0);
  assert.ok(galleryScene(6.1).press > .99); assert.equal(galleryScene(6.8).split, 1);
});
test('every outgoing product settles at the rear while its successor becomes centered', () => {
  for (let index = 0; index < 4; index++) {
    const before = galleryScene(FIRST_STACK_HOLD + (index + 1) * PRODUCT_DURATION - 1e-7), after = galleryScene(FIRST_STACK_HOLD + (index + 1) * PRODUCT_DURATION + 1e-7);
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
  assert.equal(galleryScene(48.5, 3).glass, 1); assert.equal(galleryScene(48.5, 3).index, 4);
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
  for (const intro of [0, 3]) for (const duration of [23, 30, 40, 45]) for (let frame = 0; frame <= (intro + FIRST_STACK_HOLD + duration + OUTRO_DURATION) * 60; frame++) {
    const scene = galleryScene(frame / 60, intro, duration);
    for (const n of Object.values(scene)) if (typeof n === 'number') assert.ok(Number.isFinite(n));
    for (let i = -1; i < 5; i++) for (const n of Object.values(galleryCardPose(i, scene))) if (typeof n === 'number') assert.ok(Number.isFinite(n));
  }
});
const sound = (value, duration) => ({ duration, sampleRate: 48000, numberOfChannels: 1, getChannelData: () => new Float32Array(48000 * duration).fill(value) });
test('intro audio cuts at three seconds and music begins there, without looping short intros', () => {
  const intro = { duration: 10, audio: sound(.4, 10) }, music = sound(.2, 1);
  const mixed = galleryAudio(intro, music, 5, { gain: .5, introSound: true });
  assert.ok(Math.abs(mixed.out[0][120000] - .4) < 1e-6);
  assert.ok(Math.abs(mixed.out[1][168000] - .1) < 1e-6);
  assert.equal(galleryAudio({ duration: 1, audio: sound(.4, 1) }, null, 5, { introSound: true }).out[0][72000], 0);
  assert.equal(galleryAudio(intro, null, 5, { introSound: false }), null);
  assert.ok(galleryAudio(intro, music, 5, { introEnabled: false }).out[0][24000] > .19);
});

test('incoming cards build the stack from below, tilted, in reverse showcase order', () => {
  for (let order = 0; order < 5; order++) {
    const start = 1.88 + (4 - order) * .16;
    assert.equal(galleryCardPose(order, galleryScene(start, 3)).visible, false);
    const rising = galleryCardPose(order, galleryScene(start + .1, 3));
    assert.ok(rising.y < -3); assert.ok(rising.rotateX < -.7);
    const settled = galleryCardPose(order, galleryScene(2.99, 3));
    assert.ok(Math.abs(settled.rotateX) < 1e-10); assert.equal(settled.x, 0);
    assert.ok(Math.abs(settled.z - STACK.z * order) < 1e-10);
  }
  const full = galleryCardPose(-1, galleryScene(1, 3));
  const tiny = galleryCardPose(-1, galleryScene(2.4, 3));
  assert.ok(Math.abs(tiny.scale / full.scale - .05) < 1e-10);
});
test('white ending shrinks the last slide then holds equal-height models before Become branding', () => {
  assert.equal(OUTRO_DURATION, 6);
  for (const duration of [23, 30, 40, 45]) {
    const start = 3.5 + duration;
    const first = galleryScene(start, 3, duration);
    assert.equal(first.scale, 1); assert.equal(first.glass, 1); assert.equal(first.logo, 0);
    const tiny = galleryScene(start + 1.6, 3, duration);
    assert.ok(Math.abs(tiny.scale - .05) < 1e-10);
    const lineup = galleryScene(start + 3, 3, duration);
    assert.equal(lineup.lineup, 1); assert.equal(lineup.opacity, 0); assert.equal(lineup.logo, 0);
    const last = galleryScene(start + 6, 3, duration);
    assert.equal(last.logo, 1); assert.equal(last.lineup, 0); assert.equal(last.opacity, 0); assert.equal(last.glass, 0);
    for (let order = -1; order < 4; order++) assert.equal(galleryCardPose(order, last).visible, false);
  }
});
test('intro settings contain only main text, logo, logo color and subtext', () => {
  const html = introControls();
  assert.equal((html.match(/<textarea|<select|<input/g) || []).length, 4);
  assert.ok(html.includes('data-v2-main-text') && html.includes('data-v2-subtext'));
  assert.ok(html.includes('data-v2-logo-color') && html.includes('data-v2-logo'));
  assert.equal(introLabels().length, 2);
  assert.equal(galleryAudio({ audio: sound(.4, 10) }, null, 28.5), null);
  const track = galleryAudio({ audio: sound(.4, 10) }, sound(.2, 1), 28.5);
  assert.equal(track.out[0][120000], 0); assert.ok(track.out[0][168000] > .19);
});

test('each product shows shoot, macro, man and woman, before its card reveal', () => {
  assert.equal(GALLERY_DURATION, 45); assert.equal(PRODUCT_DURATION, 9);
  for (let product = 0; product < 5; product++) {
    const start = 3.5 + product * PRODUCT_DURATION;
    for (const [offset, shot] of [[1,0], [2.9,1], [4.5,2], [6.8,3]]) {
      assert.equal(photoScene(galleryScene(start + offset, 3)).to, shot);
    }
    const sliding = photoScene(galleryScene(start + 2.45, 3));
    assert.equal(sliding.from, 0); assert.equal(sliding.to, 1); assert.ok(sliding.progress > 0 && sliding.progress < 1);
  }
});
test('stack has spacious vertical gaps and exits move upward, tilt and shrink', () => {
  assert.equal(STACK.y, .95); assert.equal(STACK.z, -1.5);
  const scene = galleryScene(9.15), pose = galleryCardPose(0, scene);
  assert.ok(pose.y > 3); assert.ok(pose.rotateX < -.3); assert.ok(pose.scale < .95);
  assert.ok(shutterTimes(2)[0] - shutterTimes(2).at(-1) > .031);
  assert.ok(shutterTimes(0).every(time => time === 0));
});

import { lineupLayout } from '../../lib/album-v2-lineup.js';
import { LOGO_SCALE } from '../../lib/album-v2-brand.js';
test('lineup normalizes alpha bounds to equal height and keeps all five people inside the frame', () => {
  assert.equal(LOGO_SCALE, .75);
  const rows = lineupLayout([{w:300,h:1000}, {w:600,h:1600}, {w:350,h:1100}, {w:480,h:1400}, {w:330,h:1000}]);
  assert.equal(new Set(rows.map(row => row.height)).size, 1);
  assert.ok(rows[0].x >= 39.99); assert.ok(rows.at(-1).x + rows.at(-1).width <= 1040.01);
  rows.slice(1).forEach((row,i) => assert.ok(row.x < rows[i].x + rows[i].width));
});
