import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function fixture() {
  const stages = [], pending = [], notices = [];
  class Stage {
    constructor(...args) { this.args = args; this.loads = []; stages.push(this); }
    add(which, url) {
      this.loads.push([which, url]);
      return new Promise((resolve, reject) => pending.push({ resolve, reject }));
    }
    setTune(tune) { this.tune = tune; }
    layout() {}
    render(turn) { this.turn = turn; return {}; }
    dispose() { this.disposed = true; }
  }
  const canvas = { width: 320, height: 568, getContext: () => ({ drawImage() {}, clearRect() {} }) };
  const context = vm.createContext({ OutfitStage: Stage, paintReelBackground() {}, Promise, Math, console: { warn() {} } });
  const code = readFileSync(new URL('../../lib/reel-preview.js', import.meta.url), 'utf8');
  vm.runInContext(code.replace(/^import .*;$/gm, '').replace(/^export /gm, '') + '\nglobalThis.Preview = FitPreview;', context);
  return { preview: new context.Preview(canvas, status => notices.push(status)), stages, pending, notices };
}
const top = { glb: 'top.glb', type: 'Oversized Tee' }, bottom = { glb: 'bottom.glb', type: 'Sweatpants' };

test('fit loads both garments together and reuses the stage for sliders and lighting', async () => {
  const f = fixture();
  const loading = f.preview.update(top, bottom, { topScale: 1, lighting: 'contrast' }, 0);
  assert.equal(f.pending.length, 2, 'both loads start before either finishes');
  assert.equal(f.stages[0].args.at(-1).preview, true);
  f.pending.forEach(p => p.resolve()); await loading;
  for (let i = 0; i < 30; i++) await f.preview.update(top, bottom, { topScale: 1.03, topX: i, lighting: 'side' }, i);
  assert.equal(f.stages.length, 1);
  assert.equal(f.stages[0].loads.length, 2);
  assert.equal(f.stages[0].tune.topX, 29);
  assert.equal(f.stages[0].turn, 29 * Math.PI / 180);
  assert.equal(f.notices.at(-1), 'ready');
});

test('new garment loads supersede slow old loads and use latest adjustments', async () => {
  const f = fixture();
  const old = f.preview.update(top, bottom, {}, 0);
  const current = f.preview.update({ ...top, glb: 'new.glb' }, bottom, {}, 0);
  f.preview.update({ ...top, glb: 'new.glb' }, bottom, { topX: 7 }, 90);
  f.pending.slice(2).forEach(p => p.resolve()); await current;
  assert.equal(f.stages[1].tune.topX, 7);
  f.pending.slice(0, 2).forEach(p => p.resolve()); await old;
  assert.equal(f.stages[0].disposed, true);
  assert.equal(f.stages[1].disposed, undefined);
  assert.equal(f.stages[1].turn, Math.PI / 2);
});

test('failed loads show an error and the same garments can be retried', async () => {
  const f = fixture();
  const failed = f.preview.update(top, bottom, {}, 0);
  f.pending[0].reject(new Error('Network failed')); f.pending[1].resolve(); await failed;
  assert.equal(f.notices.at(-1), 'error');
  assert.equal(f.stages[0].disposed, true);
  const retry = f.preview.update(top, bottom, {}, 0);
  f.pending.slice(2).forEach(p => p.resolve()); await retry;
  assert.equal(f.notices.at(-1), 'ready');
});
