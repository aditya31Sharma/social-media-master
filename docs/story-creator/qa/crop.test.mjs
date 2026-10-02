import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clampCrop } from '../../../stories/crop.js';
import { place } from '../../../lib/frame.js';

for (const [nw, nh] of [[1600, 900], [900, 1600], [1000, 1000], [4000, 300], [300, 4000]]) {
  test(`All edges covered for ${nw}x${nh}`, () => {
    for (const [fw, fh] of [[1080, 1920], [1080, 607.5]]) {
      for (const scale of [.2, 1, 1.75, 5, 9]) {
        for (const cx of [-20, -.1, 0, .1, 20]) {
          for (const cy of [-20, 0, 20]) {
            const crop = clampCrop(nw, nh, fw, fh, {scale, cx, cy});
            const p = place(nw, nh, fw, fh, crop);
            assert.ok(crop.scale >= 1 && crop.scale <= 5);
            assert.ok(p.ox <= 1e-8 && p.oy <= 1e-8);
            assert.ok(p.ox + p.dw >= fw - 1e-8 && p.oy + p.dh >= fh - 1e-8);
          }
        }
      }
    }
  });
}
test('A valid crop stays unchanged', () => {
  const crop = {scale: 2, cx: .1, cy: -.1};
  assert.deepEqual(clampCrop(1600, 900, 1080, 1920, crop), crop);
});
