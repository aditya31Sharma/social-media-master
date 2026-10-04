import assert from 'node:assert/strict';
import { test } from 'node:test';
import { albumScene, hasIntro, introOpacity } from '../../lib/album-motion.js';
import { defaultLabels, snapCenter } from '../../lib/album-text.js';
import { labelMetrics, labelRect } from '../../lib/album-render.js';

test('album intro is optional independently of its labels', () => {
  const state = { coverEnabled: false, cover: null, labels: defaultLabels() };
  assert.equal(hasIntro(state), true);
  state.labels.forEach(label => { label.enabled = false; });
  assert.equal(hasIntro(state), false);
  state.cover = {}; state.coverEnabled = true;
  assert.equal(hasIntro(state), true);
  state.coverEnabled = false;
  assert.equal(hasIntro(state), false);
  assert.equal(albumScene(0, true).intro, true);
  assert.equal(albumScene(0, false).models[0].index, 0);
});

test('showcase follows the five-model sequence with horizontal, sliced and vertical transitions', () => {
  const first = albumScene(3.4).models;
  assert.equal(first.length, 1); assert.equal(first[0].index, 0);
  const horizontal = albumScene(5.49).models;
  assert.equal(horizontal.length, 5);
  assert.equal(new Set(horizontal.map(p => p.index)).size, 5);
  assert.ok(Math.max(...horizontal.map(p => p.x)) - Math.min(...horizontal.map(p => p.x)) > .79);
  assert.equal(albumScene(6.8).models[0].index, 1);
  const slices = albumScene(7.4).models;
  assert.equal(slices.length, 6);
  assert.deepEqual([...new Set(slices.map(p => p.band))], [0, 1, 2]);
  assert.ok(slices.some(p => p.trailX));
  assert.equal(albumScene(8).models[0].index, 2);
  assert.deepEqual(albumScene(8.9).models.map(p => p.index), [2, 3]);
  assert.equal(albumScene(9.5).models[0].index, 3);
  const vertical = albumScene(12.39).models;
  assert.equal(vertical.length, 5);
  assert.ok(Math.max(...vertical.map(p => p.y)) - Math.min(...vertical.map(p => p.y)) > .73);
  assert.equal(albumScene(15).models[0].index, 4);
});

test('every export frame has finite transforms with and without an intro', () => {
  for (const intro of [true, false]) for (let i = 0; i <= 900; i++) {
    for (const pose of albumScene(i / 60, intro).models) {
      assert.ok([pose.x, pose.y, pose.scale, pose.alpha].every(Number.isFinite));
      assert.ok(pose.scale > 0 && pose.alpha >= 0 && pose.alpha <= 1);
      assert.ok(pose.index >= 0 && pose.index < 5);
    }
  }
});

test('intro reveal opacity starts at zero, settles and exits cleanly', () => {
  for (const start of [.25, .85, 1.25, 1.8]) {
    assert.equal(introOpacity(0, start), 0);
    assert.equal(introOpacity(2.4, start), 1);
    assert.equal(introOpacity(3, start), 0);
  }
});

test('center snapping uses screen pixels and allows dragging away', () => {
  assert.equal(snapCenter(.52, 300), .5);
  assert.equal(snapCenter(.54, 300), .54);
  assert.equal(snapCenter(.48, 300), .5);
});

test('text metrics include tracking and multiline spacing around the drag center', () => {
  const ctx = { measureText: text => ({ width: text.length * 20 }) };
  const label = { ...defaultLabels()[0], text: 'AB\nCD', size: 40, spacing: 5, lineHeight: 1.5, x: .5, y: .5 };
  const m = labelMetrics(ctx, label), r = labelRect(ctx, label);
  assert.equal(m.width, 45); assert.equal(m.height, 120);
  assert.equal(r.x + r.w / 2, 540); assert.equal(r.y + r.h / 2, 960);
});
