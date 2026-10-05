import assert from 'node:assert/strict';
import { test } from 'node:test';
import { galleryAudio } from '../../lib/album-v2-media.js';
import { musicRange, mixAlbumMusic, cacheMusicMix } from '../../lib/album-v2-audio.js';
const sound=(values,rate=48000)=>({sampleRate:rate,duration:values[0].length/rate,numberOfChannels:values.length,getChannelData:c=>values[c]});
const constant=(value,seconds)=>sound([new Float32Array(seconds*48000).fill(value)]);

test('intro soundtrack is excluded even if legacy introSound is enabled',()=>{
 const intro={audio:constant(.9,5)};
 assert.equal(galleryAudio(intro,null,5,{introSound:true}),null);
 const mixed=galleryAudio(intro,constant(.2,1),6,{introSound:true,gain:.5,fadeIn:0,fadeOut:0});
 for(const i of [0,24000,240000,287999])assert.ok(Math.abs(mixed.out[0][i]-.1)<1e-6);
});
test('selected music plays from the first frame, through the intro and ending',()=>{
 const mixed=mixAlbumMusic(constant(.4,2),8,{gain:.75,fadeIn:0,fadeOut:0});
 assert.equal(mixed.frames,384000);assert.equal(mixed.rate,48000);assert.equal(mixed.channels,2);
 for(const c of mixed.out)for(const i of [0,120000,383999])assert.ok(Math.abs(c[i]-.3)<1e-6);
});
test('trim endpoints select only the requested section and loop inside that section',()=>{
 const samples=Float32Array.from({length:400},(_,i)=>Math.floor(i/100)/4),song=sound([samples],100);
 const mix=mixAlbumMusic(song,3,{start:1,end:3,gain:1,fadeIn:0,fadeOut:0});
 assert.equal(mix.out[0][0],.25);assert.equal(mix.out[0][48000],.5);assert.equal(mix.out[0][96000],.25);
});
test('no-loop selection stops at its end and fades there',()=>{
 const mix=mixAlbumMusic(constant(.5,4),6,{start:1,end:3,loop:false,gain:1,fadeIn:0,fadeOut:1});
 assert.equal(mix.out[0][24000],.5);assert.ok(mix.out[0][72000]>.24&&mix.out[0][72000]<.26);
 assert.equal(mix.out[0][96000],0);assert.equal(mix.out[0].at(-1),0);
});
test('fade sliders affect only the envelope and zero gain gives silence',()=>{
 const mix=mixAlbumMusic(constant(1,3),3,{gain:.5,fadeIn:1,fadeOut:1});
 assert.equal(mix.out[0][0],0);assert.ok(Math.abs(mix.out[0][24000]-.25)<1e-6);
 assert.equal(mix.out[0][72000],.5);assert.equal(mix.out[0].at(-1),0);
 assert.ok(mixAlbumMusic(constant(.5,1),1,{gain:0}).out[0].every(v=>v===0));
});
test('stereo balance and different sample rates are preserved',()=>{
 const song=sound([new Float32Array(44100).fill(.2),new Float32Array(44100).fill(-.4)],44100);
 const mix=mixAlbumMusic(song,1,{gain:1,fadeIn:0,fadeOut:0});
 assert.ok(Math.abs(mix.out[0][24000]-.2)<1e-6);assert.ok(Math.abs(mix.out[1][24000]+.4)<1e-6);
});
test('ranges follow reel duration unless explicitly trimmed and remain bounded',()=>{
 const song=constant(.2,100);
 assert.deepEqual(musicRange(song,40,{start:10}),{start:10,end:50,length:40});
 assert.deepEqual(musicRange(song,50,{start:10,end:25}),{start:10,end:25,length:15});
 const range=musicRange(song,40,{start:200,end:-10});assert.ok(range.start<range.end&&range.end<=100);
 assert.equal(mixAlbumMusic(null,40),null);
});
test('mix cache reuses playback PCM but invalidates every audio setting and duration',()=>{
 const get=cacheMusicMix(),song=constant(.5,5),options={gain:.5,start:0,end:3,fadeIn:.2,fadeOut:.2,loop:true};
 let previous=get(song,4,options);assert.equal(get(song,4,{...options}),previous);
 for(const [key,value] of [['gain',.8],['start',1],['end',4],['fadeIn',1],['fadeOut',1],['loop',false]]){const next=get(song,4,{...options,[key]:value});assert.notEqual(next,previous);previous=next;}
 assert.notEqual(get(song,5,options),previous);assert.equal(get(null,5,options),null);
});
