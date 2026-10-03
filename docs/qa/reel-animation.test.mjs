import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import * as G from '../../lib/reel-geom.js';
import * as F from '../../lib/frame.js';

// Compare actual renderer commands against the version before cover support.
const root = new URL('../../', import.meta.url);
const historical = execFileSync('git', ['show', '831e322^:lib/reel.js'], { cwd: root, encoding: 'utf8' });
const current = readFileSync(new URL('../../lib/reel.js', import.meta.url), 'utf8');
async function renderer(source) {
  let trace = [];
  const record = (name, args) => trace.push([name, ...args.map(value => value?.tag || value)]);
  class Canvas {
    constructor(width, height) { this.width = width; this.height = height; this.tag = `canvas:${width}x${height}`; }
    getContext() {
      return new Proxy({ filter: 'none', measureText: text => ({ width: text.length * 10 }) }, {
        get: (target, name) => name in target ? target[name] : (...args) => record(name, args),
        set: (target, name, value) => { record(`set:${name}`, [value]); target[name] = value; return true; },
      });
    }
  }
  class Stage {
    async add() {} layout() {} dispose() {}
    setEntry(k) { record('entry', [k]); }
    render(turn) { record('turn', [turn]); return { tag: 'garments' }; }
  }
  class Image { tag = 'logo'; async decode() {} }
  const context = vm.createContext({ G, F, OutfitStage: Stage, OffscreenCanvas: Canvas, Image, Math });
  vm.runInContext(source.replace(/^import .*;$/gm, '').replace(/^export /gm, '') + '\nglobalThis.build = createReel;', context);
  const photo = { url: 'photo', bitmap: { width: 100, height: 100, tag: 'photo' } };
  const slots = Object.fromEntries(G.PHOTOS.map(p => [p.slot, [photo]]));
  const reel = await context.build({ width: 1080, top: { heading: 'Top', sub: 'Top detail' }, bottom: { heading: 'Bottom', sub: 'Bottom detail' }, slots, logoUrl: 'logo' });
  return { reel, reset: () => { trace = []; }, commands: () => JSON.parse(JSON.stringify(trace)) };
}

test('all 900 video frames match the original animation commands', async () => {
  const before = await renderer(historical), after = await renderer(current);
  for (let i = 0; i < G.FRAMES; i++) {
    before.reset(); after.reset();
    before.reel.drawFrame(i); after.reel.drawFrame(i);
    assert.deepEqual(after.commands(), before.commands(), `Frame ${i}`);
  }
});

test('cover uses final pose and text without photos, and does not alter subsequent video frames', async () => {
  const normal = await renderer(current), cover = await renderer(current);
  normal.reset(); const videoSurface = normal.reel.drawFrame(G.FRAMES - 1);
  const last = normal.commands();
  cover.reset(); const coverSurface = cover.reel.drawCover();
  const commands = cover.commands();
  const layers = list => list.filter(op => ['entry', 'turn', 'fillText'].includes(op[0]));
  assert.deepEqual(layers(commands), layers(last));
  assert.ok(commands.some(op => op[0] === 'drawImage' && op[1] === 'logo'));
  assert.ok(commands.some(op => op[0] === 'drawImage' && op[1] === 'garments'));
  assert.ok(!commands.some(op => op.includes('photo')));
  assert.deepEqual([coverSurface.width, coverSurface.height], [videoSurface.width, videoSurface.height]);
  assert.notEqual(coverSurface, cover.reel.drawFrame(0));
  const baseline = await renderer(historical);
  baseline.reset(); cover.reset(); baseline.reel.drawFrame(0); cover.reel.drawFrame(0);
  assert.deepEqual(cover.commands(), baseline.commands());
});
