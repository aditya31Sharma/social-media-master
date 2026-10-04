import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { LIGHTING, lightingFor } from '../../lib/reel-lighting.js';
import { LIGHT, FABRIC } from '../../lib/reel-geom.js';

test('missing and unknown lighting resolve to Defined edges', () => {
  for (const name of [undefined, null, '', 'unknown', '__proto__']) {
    assert.equal(lightingFor(name), LIGHTING.contrast);
  }
});

test('the Original lighting calibration remains available', () => {
  assert.deepEqual(lightingFor('original'), { ...LIGHT, envMat: FABRIC.envMat });
});

test('every lighting preset is selectable and Defined edges is selected initially', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const select = html.match(/<select id="reelLighting"[\s\S]*?<\/select>/)[0];
  const options = [...select.matchAll(/<option value="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(options.sort(), Object.keys(LIGHTING).sort());
  assert.match(select, /<option value="contrast" selected>/);
});
