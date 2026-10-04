import assert from 'node:assert/strict';
import { test } from 'node:test';
import { albumScene, hasIntro, introOpacity, DETAIL_STARTS, ALBUM_DURATION } from '../../lib/album-motion.js';
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
  assert.equal(albumScene(0, false).models.at(-1).index, 0);
});

test('showcase opens with five exactly centered models and holds both expanded lineups', () => {
  const stack = albumScene(0).models;
  assert.equal(stack.length, 5); assert.equal(stack.at(-1).index, 0);
  assert.ok(stack.every(p => p.x === .5 && p.y === .53 && p.scale === 1 && p.alpha === 1));
  assert.deepEqual(albumScene(3).models, albumScene(4.9).models);
  assert.deepEqual(albumScene(34.7).models, albumScene(36.9).models);
  const horizontal = albumScene(4).models, vertical = albumScene(36).models;
  assert.ok(Math.max(...horizontal.map(p => p.x)) - Math.min(...horizontal.map(p => p.x)) > .79);
  assert.ok(Math.max(...vertical.map(p => p.y)) - Math.min(...vertical.map(p => p.y)) > .73);
  const slices = albumScene(19.4).models;
  assert.equal(slices.length, 6);
  assert.deepEqual([...new Set(slices.map(p => p.band))], [0, 1, 2]);
  assert.ok(slices.some(p => p.trailX));
  assert.deepEqual(albumScene(26.2).models.map(p => p.index), [2, 3]);
  assert.equal(albumScene(ALBUM_DURATION).models[0].index, 4);
});

test('every outfit zooms bottom-left, holds its product detail and returns before transitioning', () => {
  DETAIL_STARTS.forEach((start, index) => {
    const detail = albumScene(start + 2);
    assert.equal(detail.detail.index, index); assert.equal(detail.detail.amount, 1);
    assert.ok(detail.models[0].x < .5 && detail.models[0].y > .53 && detail.models[0].scale > 1);
    assert.deepEqual(detail, albumScene(start + 3.4));
    const returned = albumScene(start + 4.5).models;
    assert.equal(returned.length, 1); assert.equal(returned[0].index, index);
    assert.equal(returned[0].x, .5); assert.equal(returned[0].scale, 1);
  });
});

test('intro can be disabled without erasing labels or cover;30s uses the same choreography', () => {
  const state = { introEnabled: false, coverEnabled: true, cover: {}, labels: defaultLabels() };
  assert.equal(hasIntro(state), false); state.introEnabled = true; assert.equal(hasIntro(state), true);
  assert.deepEqual(albumScene(30, false, 30), albumScene(45));
  assert.deepEqual(albumScene(8 * 30 / 45, false, 30), albumScene(8));
  assert.deepEqual(albumScene(3, true), albumScene(0));
});

test('every export frame has finite transforms with and without an intro', () => {
  for (const intro of [true, false]) for (let i = 0; i <= ALBUM_DURATION * 60; i++) {
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
