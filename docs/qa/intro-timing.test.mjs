import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clipRange, introHold, introSourceTime } from '../../lib/intro-timing.js';
test('selected clip defines intro hold and source offset without leaking outside trim',()=>{
 const state={intro:{kind:'video',duration:20},introRange:{start:7,end:12}};
 assert.equal(introHold(state),5);assert.equal(introSourceTime(0,20,state.introRange),7);
 assert.equal(introSourceTime(2,20,state.introRange),9);
 assert.ok(introSourceTime(9,20,state.introRange)<12);
});
test('range clamps short clips, reversed bounds and source end',()=>{
 for(const duration of [.04,.5,3,120])for(const range of [{},{start:-3,end:200},{start:119,end:1}]){
 const r=clipRange(duration,range);assert.ok(r.start>=0&&r.end>r.start&&r.end<=duration+.00001);
 }
});
test('image intro has independent adjustable hold and video defaults to3.5s',()=>{
 assert.equal(introHold({intro:{kind:'image'},introStillDuration:6}),6);
 assert.equal(introHold({intro:{kind:'video',duration:20}}),3.5);
});
