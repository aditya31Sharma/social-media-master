import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { LIGHTING, lightingFor, lightPosition } from '../../lib/reel-lighting.js';
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


test('new lighting rigs change position and strength without color or exposure effects', () => {
  for (const name of ['side', 'overhead', 'backlit', 'cross', 'lowkey']) {
    const light = lightingFor(name);
    assert.ok(!Object.keys(light).some(key => key.endsWith('Color')));
    for (const key of ['exposure', 'tone', 'env', 'envMat']) assert.equal(light[key], LIGHTING.contrast[key]);
    for (const role of ['key', 'fill', 'rim']) {
      const xyz = lightPosition(light, role);
      assert.ok(xyz.every(Number.isFinite));
      assert.ok(Math.abs(Math.hypot(...xyz) - 300) < 1e-8);
    }
  }
  assert.ok(lightPosition(LIGHTING.overhead, 'key')[1] > 290, 'overhead key is nearly above the garments');
  assert.ok(lightPosition(LIGHTING.backlit, 'rim')[2] < -200, 'rim comes from behind');
  assert.ok(LIGHTING.backlit.rim > LIGHTING.backlit.key);
  assert.ok(lightPosition(LIGHTING.cross, 'key')[0] < 0);
  assert.ok(lightPosition(LIGHTING.cross, 'fill')[0] > 0);
});

test('Defined edges retains its original light positions and intensities', () => {
  assert.deepEqual(LIGHTING.contrast, { ...LIGHT, exposure: .8, key: 6, keyAz: 65, keyEl: 50, fill: .6, rim: 4, ambient: .05, envMat: .3 });
  const az = 65 * Math.PI / 180, el = 50 * Math.PI / 180;
  assert.deepEqual(lightPosition(LIGHTING.contrast, 'key'), [Math.sin(az) * Math.cos(el) * 300, Math.sin(el) * 300, Math.cos(az) * Math.cos(el) * 300]);
  assert.deepEqual(lightPosition(LIGHTING.contrast, 'fill'), [-Math.sin(az) * 300 * .7, 40, Math.cos(az) * 300 * .7 + 120]);
  assert.deepEqual(lightPosition(LIGHTING.contrast, 'rim'), [Math.sin(az + Math.PI) * 300, 90, -240]);
  for (const name of ['golden', 'moonlight', 'tealAmber', 'neon', 'noir']) assert.equal(lightingFor(name), LIGHTING.contrast);
});
