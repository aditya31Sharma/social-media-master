import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as G from '../../lib/reel-geom.js';

const context = vm.createContext({ G, Math });
const source = readFileSync(new URL('../../lib/reel.js', import.meta.url), 'utf8');
vm.runInContext(source.replace(/^import .*;$/gm, '').replace(/^export /gm, '') + '\nglobalThis.sequence = closingSequence; globalThis.at = photoAt;', context);
const photos = [{ url: 'first' }, { url: 'second' }, { url: 'closer' }];
const make = (options = {}) => context.sequence(photos[2], photos, { start: G.SWITCH_START, rnd: () => .5, ...options });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);

test('photo switches retain their initial cadence until 12 seconds', () => {
  const sequence = make();
  for (let i = 0; i < sequence.length - 1; i++) {
    if (sequence.times[i + 1] <= 12) near(sequence.holds[i], .2);
  }
  const before = sequence.times.findLastIndex(t => t < 12);
  assert.ok(sequence.holds[before] < .2 + 1 / G.FPS, 'no jump when deceleration begins');
});

test('photo holds lengthen smoothly after 12 seconds and finish on the selected shot', () => {
  const sequence = make();
  const tail = sequence.holds.filter((_, i) => sequence.times[i] >= 12);
  assert.ok(tail.length >= 6, 'several steps spread the slowdown across the final three seconds');
  for (let i = 1; i < tail.length; i++) assert.ok(tail[i] > tail[i - 1]);
  assert.ok(tail.at(-1) > .7);
  near(sequence.start + sequence.holds.reduce((sum, hold) => sum + hold, 0), 15);
  assert.equal(context.at(sequence, 899 / 60).photo, photos[2]);
  assert.ok(sequence.holds.every(hold => hold > 0));
});

test('all corners share cut timestamps regardless of photo order', () => {
  const baseline = make();
  for (const rnd of [() => .1, () => .8, () => .99]) {
    assert.deepEqual(make({ rnd }).times, baseline.times);
  }
  const single = context.sequence(photos[0], [photos[0]], { start: G.SWITCH_START });
  assert.deepEqual(single.times, baseline.times);
  assert.ok(single.every(card => card.photo === photos[0]));
});
