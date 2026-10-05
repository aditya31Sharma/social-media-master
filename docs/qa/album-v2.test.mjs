import assert from 'node:assert/strict';
import { test } from 'node:test';
import { galleryScene, galleryCardPose, INTRO_DURATION, FIRST_STACK_HOLD, OUTRO_DURATION, PRODUCT_DURATION, GALLERY_DURATION, STACK, photoScene, shutterTimes, PRODUCT_ORDER, frontPhotoIndex, lineupEntrance } from '../../lib/album-v2-motion.js';
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
test('30-second reel holds the first stack and stages alternating full-body details', () => {
  assert.equal(INTRO_DURATION + FIRST_STACK_HOLD + GALLERY_DURATION + OUTRO_DURATION, 30);
  assert.equal(FIRST_STACK_HOLD, .5); assert.equal(galleryScene(3.49, 3).zoom, 0);
  assert.ok(galleryScene(3.8, 3).zoom > 0);
  assert.deepEqual(PRODUCT_ORDER, [1, 2, 3, 4, 0]);
  for (let i = 0; i < 5; i++) {
    const start = 3.5 + i * PRODUCT_DURATION;
    assert.equal(galleryScene(start + 2, 3).detail, 0);
    assert.equal(photoScene(galleryScene(start + 2.8, 3)).to, i % 2 ? 3 : 2);
    assert.equal(galleryScene(start + 2.8, 3).detail, 1);
    assert.equal(galleryScene(start + 3.9, 3).detail, 0);
    assert.equal('glass' in galleryScene(start + 2.8, 3), false);
    assert.equal('split' in galleryScene(start + 2.8, 3), false);
  }
});
test('garments turn slowly regardless of selected duration, without a bag or cursor', () => {
  for (const duration of [22, 30, 45]) {
    const base = FIRST_STACK_HOLD + 2.5 * duration / GALLERY_DURATION;
    const a = galleryScene(base, 0, duration), b = galleryScene(base + .2, 0, duration);
    assert.ok(Math.abs(b.turn - a.turn - .2 * Math.PI * 2 / 10) < 1e-10);
    assert.equal('cursor' in a, false); assert.equal('press' in a, false);
  }
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
  assert.equal(galleryScene(25.5, 3).detail, 0); assert.equal(galleryScene(25.5, 3).index, 4);
});
test('product names use the same split as the carousel', () => {
  assert.deepEqual(splitTitle('Victor Doom Polo Sweatshirt Olive', 'Polo Sweatshirt'), ['Victor Doom', 'Polo Sweatshirt Olive']);
  assert.deepEqual(splitTitle('Stand Unshaken Oversized Hoodie Acid Black', 'Oversized Hoodie'), ['Stand Unshaken', 'Oversized Hoodie Acid Black']);
});
test('all frame poses remain finite with and without intro at either gallery duration', () => {
  for (const intro of [0, 3]) for (const duration of [22, 23, 30, 40, 45]) for (let frame = 0; frame <= (intro + FIRST_STACK_HOLD + duration + OUTRO_DURATION) * 60; frame++) {
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
test('ending hides the shrinking slide early and reveals models one by one before branding', () => {
  assert.equal(OUTRO_DURATION, 4.5);
  const start = INTRO_DURATION + FIRST_STACK_HOLD + GALLERY_DURATION;
  const first = galleryScene(start, 3); assert.equal(first.scale, 1); assert.equal(first.opacity, 1);
  const faded = galleryScene(start + .5, 3); assert.equal(faded.opacity, 0); assert.ok(faded.scale > .3);
  assert.ok(Math.abs(galleryScene(start + .9, 3).scale - .05) < 1e-10);
  for (let index = 0; index < 5; index++) {
    assert.ok(lineupEntrance(.55 + index * .3, index) < 1e-10);
    assert.equal(lineupEntrance(.95 + index * .3, index), 1);
    if (index < 4) assert.equal(lineupEntrance(.7 + index * .3, index + 1), 0);
  }
  const last = galleryScene(start + OUTRO_DURATION, 3);
  assert.equal(last.logo, 1); assert.equal(last.lineup, 0); assert.equal(last.opacity, 0);
});
test('intro restores full font, typography, position and snapping controls for both text layers', () => {
  const html = introControls();
  for (const field of ['data-layer', 'data-font', 'data-local-fonts', 'data-font-upload', 'data-text-size', 'data-text-spacing', 'data-text-lineHeight', 'data-text-color', 'data-text-weight', 'data-text-x', 'data-text-y', 'data-center-x', 'data-center-y']) assert.ok(html.includes(field), field);
  assert.ok(html.includes('data-v2-logo-color') && html.includes('data-v2-logo'));
  assert.equal(introLabels().length, 2); assert.ok(!html.includes('value="album"'));
  assert.equal(galleryAudio({ audio: sound(.4, 10) }, null, 30), null);
});

test('each product uses shoot, macro and only the alternating front image', () => {
  assert.equal(GALLERY_DURATION, 22); assert.equal(PRODUCT_DURATION, 4.4);
  assert.deepEqual([0,1,2,3,4].map(frontPhotoIndex), [2,3,2,3,2]);
  for (let index = 0; index < 5; index++) {
    const start = 3.5 + index * PRODUCT_DURATION;
    for (const [offset, shot] of [[.5,0], [1.2,1], [2,frontPhotoIndex(index)]]) assert.equal(photoScene(galleryScene(start + offset, 3)).to, shot);
    const sliding = photoScene(galleryScene(start + 1.75, 3));
    assert.equal(sliding.from, 1); assert.ok(sliding.progress > 0 && sliding.progress < 1);
  }
});
test('stack has spacious vertical gaps and exits move upward, tilt and shrink', () => {
  assert.equal(STACK.y, .475); assert.equal(STACK.z, -1.5);
  const scene = galleryScene(4.75), pose = galleryCardPose(0, scene);
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

import { GARMENT, personPose, paintProductDetail } from '../../lib/album-v2-detail.js';
test('larger garment overlaps the left person and is painted behind the person', () => {
  const person = {image: {width:1600,height:2400},crop:{x:450,y:80,w:700,h:2220}};
  const pose = personPose(person,1); assert.ok(pose.x>=0); assert.ok(pose.x+pose.width<600);
  assert.ok(GARMENT.size>660); assert.ok(GARMENT.x<pose.x+pose.width);
  const garment = {}, drawOrder = [], texts = [];
  const ctx = {save(){},restore(){},fillRect(){},drawImage(image){drawOrder.push(image);},fillText(text,x,y){texts.push({text,x,y});},measureText(text){return {width:text.length*20};}};
  paintProductDetail(ctx,garment,person,{productName:'Victor Doom Polo Sweatshirt Olive',type:'Polo Sweatshirt'},1);
  assert.deepEqual(drawOrder,[garment,person.image]);
  assert.ok(texts.every(item=>item.y>GARMENT.y+GARMENT.size));
  assert.ok(!texts.some(item=>/bag/i.test(item.text)));
});
