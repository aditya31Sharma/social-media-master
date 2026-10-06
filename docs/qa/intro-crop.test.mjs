import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultIntroCrop, introPlacement } from '../../lib/intro-crop.js';
test('intro crop fills9:16 for landscape, portrait and square sources at every zoom', () => {
  for (const [width,height] of [[1920,1080],[720,1280],[1080,1080],[720,1920]]) {
    for (const scale of [1,2,5]) for (const cx of [-100,0,100]) for (const cy of [-100,0,100]) {
      const p=introPlacement({width,height},{scale,cx,cy});
      assert.ok(p.ox<=.00001 && p.oy<=.00001);
      assert.ok(p.ox+p.dw>=1080-.00001 && p.oy+p.dh>=1920-.00001);
    }
  }
});
test('crop is identical proportionally in preview and export', () => {
  const video={videoWidth:1920,videoHeight:1080}, crop={scale:2.3,cx:.75,cy:-.4};
  const preview=introPlacement(video,crop,360,640), output=introPlacement(video,crop);
  for (const key of ['ox','oy','dw','dh']) assert.ok(Math.abs(preview[key]*3-output[key])<.00001);
});
test('reset returns independent centered crop, zoom clamps at cover and500 percent', () => {
  const first=defaultIntroCrop();first.cx=2;
  assert.equal(defaultIntroCrop().cx,0);
  assert.equal(introPlacement({width:100,height:100},{scale:.1,cx:0,cy:0}).adjust.scale,1);
  assert.equal(introPlacement({width:100,height:100},{scale:10,cx:0,cy:0}).adjust.scale,5);
});
