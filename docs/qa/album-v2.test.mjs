import assert from 'node:assert/strict';
import { test } from 'node:test';
import { galleryScene, galleryCardPose, INTRO_DURATION, INTRO_HOLD, FIRST_STACK_HOLD, OUTRO_DURATION, PRODUCT_DURATION, GALLERY_DURATION, STACK, photoScene, shutterTimes, PRODUCT_ORDER, frontPhotoIndex, lineupEntrance, DETAIL_TIMING, sceneShutterTimes } from '../../lib/album-v2-motion.js';
import { galleryAudio } from '../../lib/album-v2-media.js';
import { introLabels, introControls } from '../../lib/album-v2-labels.js';
import { splitTitle } from '../../lib/shopify.js';

test('intro holds for 3.5 seconds and labels appear abruptly before receding with its card', () => {
  assert.equal(INTRO_HOLD, 3.5); assert.equal(INTRO_DURATION, 4.8);
  assert.equal(galleryScene(3.5, INTRO_DURATION).zoom, 1);
  assert.ok(galleryScene(3.6, INTRO_DURATION).zoom < 1);
  assert.equal(galleryScene(.499, 3).labels, false);
  assert.equal(galleryScene(.5, 3).labels, true);
  assert.equal(galleryScene(2.9, 3).labels, true);
  assert.ok(galleryScene(2.15, 3).zoom < 1);
  assert.equal(galleryScene(2.8, 3).zoom, 0);
  assert.equal(galleryCardPose(-1, galleryScene(3, 3)).visible, false);
  assert.equal(galleryScene(3, 3).index, 0);
  const labels = introLabels();
  assert.equal(labels.find(l => l.id === 'heading').text, 'Winter is\nComing');
  assert.equal(labels.find(l => l.id === 'creator').text, "Fall-Winter '26");
  assert.equal(labels[0].font, 'CarolGothic'); assert.equal(labels[1].font, 'Geist');
});
test('41.8-second reel holds the first stack and stages alternating full-body details', () => {
  assert.equal(INTRO_DURATION + FIRST_STACK_HOLD + GALLERY_DURATION + OUTRO_DURATION, 41.8);
  assert.equal(FIRST_STACK_HOLD, .5); assert.equal(galleryScene(3.49, 3).zoom, 0);
  assert.ok(galleryScene(3.8, 3).zoom > 0);
  assert.deepEqual(PRODUCT_ORDER, [1, 2, 3, 4, 0]);
  for (let i = 0; i < 5; i++) {
    const start = 3.5 + i * PRODUCT_DURATION;
    assert.equal(galleryScene(start + 2, 3).detail, 0);
    assert.equal(photoScene(galleryScene(start + 3.5, 3)).to, i % 2 ? 3 : 2);
    assert.equal(galleryScene(start + 3.5, 3).detail, 1);
    assert.equal(galleryScene(start + 5.7, 3).detail, 0);
    assert.equal('glass' in galleryScene(start + 3.5, 3), false);
    assert.equal('split' in galleryScene(start + 3.5, 3), false);
  }
});
test('garments turn slowly regardless of selected duration, without a bag or cursor', () => {
  for (const duration of [22, 30, 32, 45]) {
    const base = FIRST_STACK_HOLD + 3.5 * duration / GALLERY_DURATION;
    const a = galleryScene(base, 0, duration), b = galleryScene(base + .2, 0, duration);
    assert.ok(Math.abs(b.turn - a.turn - .2 * Math.PI * 2 / 10) < 1e-10);
    assert.equal('cursor' in a, false); assert.equal('press' in a, false);
  }
});
test('every outgoing product settles at the rear while its successor becomes centered', () => {
  for (let index = 0; index < 4; index++) {
    const before = galleryScene(FIRST_STACK_HOLD + (index + 1) * PRODUCT_DURATION - 1e-7), after = galleryScene(FIRST_STACK_HOLD + (index + 1) * PRODUCT_DURATION + 1e-7);
    assert.ok(galleryCardPose(index, before).z < -2.9);
    assert.equal(galleryCardPose(index, after).visible, true);
    for (let order = 0; order < 5; order++) {
      const a = galleryCardPose(order, before), b = galleryCardPose(order, after);
      for (const key of ['x', 'y', 'z', 'rotateX', 'rotateZ', 'opacity']) assert.ok(Math.abs(a[key] - b[key]) < 1e-5, `${index}/${order}/${key}`);
    }
  }
});
test('intro handoff has continuous product positions and the final product holds', () => {
  for (let order = 0; order < 5; order++) {
    const before = galleryCardPose(order, galleryScene(3 - 1e-7, 3)), after = galleryCardPose(order, galleryScene(3, 3));
    for (const key of ['x', 'y', 'z', 'rotateX']) assert.ok(Math.abs(before[key] - after[key]) < 1e-5);
  }
  assert.equal(galleryScene(35.5, 3).detail, 0); assert.equal(galleryScene(35.5, 3).index, 4);
});
test('product names use the same split as the carousel', () => {
  assert.deepEqual(splitTitle('Victor Doom Polo Sweatshirt Olive', 'Polo Sweatshirt'), ['Victor Doom', 'Polo Sweatshirt Olive']);
  assert.deepEqual(splitTitle('Stand Unshaken Oversized Hoodie Acid Black', 'Oversized Hoodie'), ['Stand Unshaken', 'Oversized Hoodie Acid Black']);
});
test('all frame poses remain finite with and without intro at either gallery duration', () => {
  for (const intro of [0, 3, INTRO_DURATION]) for (const duration of [22, 23, 30, 32, 40, 45]) for (let frame = 0; frame <= (intro + FIRST_STACK_HOLD + duration + OUTRO_DURATION) * 60; frame++) {
    const scene = galleryScene(frame / 60, intro, duration);
    for (const n of Object.values(scene)) if (typeof n === 'number') assert.ok(Number.isFinite(n));
    for (let i = -1; i < 5; i++) for (const n of Object.values(galleryCardPose(i, scene))) if (typeof n === 'number') assert.ok(Number.isFinite(n));
  }
});
const sound = (value, duration) => ({ duration, sampleRate: 48000, numberOfChannels: 1, getChannelData: () => new Float32Array(48000 * duration).fill(value) });
test('intro audio cuts after the intro transition and music begins there, without looping short intros', () => {
  const intro = { duration: 10, audio: sound(.4, 10) }, music = sound(.2, 1);
  const mixed = galleryAudio(intro, music, 6, { gain: .5, introSound: true });
  assert.ok(Math.abs(mixed.out[0][120000] - .4) < 1e-6);
  assert.ok(Math.abs(mixed.out[1][249600] - .1) < 1e-6);
  assert.equal(galleryAudio({ duration: 1, audio: sound(.4, 1) }, null, 5, { introSound: true }).out[0][72000], 0);
  assert.equal(galleryAudio(intro, null, 5, { introSound: false }), null);
  assert.ok(galleryAudio(intro, music, 6, { introEnabled: false }).out[0][24000] > .19);
});

test('incoming cards build the stack from below, tilted, in reverse showcase order', () => {
  for (let order = 0; order < 5; order++) {
    const start = 1.88 + (4 - order) * .16;
    assert.equal(galleryCardPose(order, galleryScene(start, 3)).visible, false);
    const rising = galleryCardPose(order, galleryScene(start + .1, 3));
    assert.ok(rising.y < -3); assert.ok(rising.rotateX < -.7);
    const settled = galleryCardPose(order, galleryScene(2.99, 3));
    assert.ok(Math.abs(settled.rotateX) < 1e-10); assert.equal(settled.x, 0);
    assert.ok(Math.abs(settled.z - STACK.z * order) < 1e-10);
  }
  const full = galleryCardPose(-1, galleryScene(1, 3));
  const tiny = galleryCardPose(-1, galleryScene(2.4, 3));
  assert.ok(Math.abs(tiny.scale / full.scale - .05) < 1e-10);
});
test('ending hides the shrinking slide early and reveals models one by one before branding', () => {
  assert.equal(OUTRO_DURATION, 4.5);
  const start = INTRO_DURATION + FIRST_STACK_HOLD + GALLERY_DURATION;
  const first = galleryScene(start, INTRO_DURATION); assert.equal(first.scale, 1); assert.equal(first.opacity, 1);
  const faded = galleryScene(start + .5, INTRO_DURATION); assert.equal(faded.opacity, 0); assert.ok(faded.scale > .3);
  assert.ok(Math.abs(galleryScene(start + .9, INTRO_DURATION).scale - .05) < 1e-10);
  for (let index = 0; index < 5; index++) {
    assert.ok(lineupEntrance(.55 + index * .3, index) < 1e-10);
    assert.equal(lineupEntrance(.95 + index * .3, index), 1);
    if (index < 4) assert.equal(lineupEntrance(.7 + index * .3, index + 1), 0);
  }
  const last = galleryScene(start + OUTRO_DURATION, INTRO_DURATION);
  assert.equal(last.logo, 1); assert.equal(last.lineup, 1); assert.equal(last.opacity, 0);
});
test('intro restores full font, typography, position and snapping controls for both text layers', () => {
  const html = introControls();
  for (const field of ['data-layer', 'data-font', 'data-local-fonts', 'data-font-upload', 'data-text-size', 'data-text-spacing', 'data-text-lineHeight', 'data-text-color', 'data-text-x', 'data-text-y', 'data-center-x', 'data-center-y']) assert.ok(html.includes(field), field);
  assert.ok(html.includes('data-v2-logo-color') && html.includes('data-v2-logo'));
  assert.equal(introLabels().length, 2); assert.ok(!html.includes('value="album"'));
  assert.equal(galleryAudio({ audio: sound(.4, 10) }, null, 30), null);
});

test('each product uses shoot, macro and only the alternating front image', () => {
  assert.equal(GALLERY_DURATION, 32); assert.equal(PRODUCT_DURATION, 6.4);
  assert.deepEqual([0,1,2,3,4].map(frontPhotoIndex), [2,3,2,3,2]);
  for (let index = 0; index < 5; index++) {
    const start = 3.5 + index * PRODUCT_DURATION;
    for (const [offset, shot] of [[.7,0], [1.5,1], [2.35,frontPhotoIndex(index)]]) assert.equal(photoScene(galleryScene(start + offset, 3)).to, shot);
    const sliding = photoScene(galleryScene(start + 2.05, 3));
    assert.equal(sliding.from, 1); assert.ok(sliding.progress > 0 && sliding.progress < 1);
  }
});
test('stack has spacious vertical gaps and exits move upward, tilt and shrink', () => {
  assert.equal(STACK.y, .475); assert.equal(STACK.z, -1.5);
  const scene = galleryScene(6.75), pose = galleryCardPose(0, scene);
  assert.ok(pose.y > 3); assert.ok(pose.rotateX < -.3); assert.ok(pose.scale < .95);
  assert.ok(shutterTimes(2)[0] - shutterTimes(2).at(-1) > .031);
  assert.ok(shutterTimes(0).every(time => time === 0));
});

import { lineupLayout } from '../../lib/album-v2-lineup.js';
import { LOGO_SCALE } from '../../lib/album-v2-brand.js';
test('lineup normalizes alpha bounds to equal height and keeps all five people inside the frame', () => {
  assert.equal(LOGO_SCALE, .75);
  const rows = lineupLayout([{w:300,h:1000}, {w:600,h:1600}, {w:350,h:1100}, {w:480,h:1400}, {w:330,h:1000}]);
  assert.equal(new Set(rows.map(row => row.height)).size, 1);
  assert.ok(rows[0].x >= 39.99); assert.ok(rows.at(-1).x + rows.at(-1).width <= 1040.01);
  rows.slice(1).forEach((row,i) => assert.ok(row.x < rows[i].x + rows[i].width));
});

import { GARMENT, PERSON_ZOOM, personPose, paintProductDetail } from '../../lib/album-v2-detail.js';
test('larger garment overlaps the left person and is painted behind the person', () => {
  const person = {image: {width:1600,height:2400},crop:{x:450,y:80,w:700,h:2220}};
  const pose = personPose(person,1); assert.equal(pose.x + pose.width / 2, 142); assert.ok(pose.x+pose.width<650);
  assert.ok(GARMENT.size>660); assert.ok(GARMENT.x<pose.x+pose.width);
  const garment = {}, drawOrder = [], texts = [];
  const ctx = {save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillRect(){},drawImage(image){drawOrder.push(image);},fillText(text,x,y){texts.push({text,x,y});},measureText(text){return {width:text.length*20};}};
  paintProductDetail(ctx,garment,person,{productName:'Victor Doom Polo Sweatshirt Olive',type:'Polo Sweatshirt'},1);
  assert.deepEqual(drawOrder,[garment,person.image]);
  assert.equal(texts[0].y-GARMENT.y-GARMENT.size,70);
  assert.ok(!texts.some(item=>/bag/i.test(item.text)));
});

test('person grows and moves left at the same time, with an uncropped head anchor', () => {
  const person = {image:{width:1600,height:2400},crop:{x:450,y:80,w:700,h:2220}};
  const start = personPose(person,0), middle = personPose(person,.5), end = personPose(person,1);
  assert.equal(PERSON_ZOOM,1.3); assert.ok(Math.abs(end.height/start.height-1.3)<1e-10);
  assert.ok(start.height<middle.height && middle.height<end.height);
  const center = pose => pose.x + pose.width/2;
  assert.ok(center(start)>center(middle) && center(middle)>center(end));
  assert.equal(end.y,100);
});
test('all five default product details stay fully settled for two seconds', () => {
  const settled = DETAIL_TIMING.start + DETAIL_TIMING.enter;
  assert.equal(DETAIL_TIMING.hold,2); assert.equal(DETAIL_TIMING.enter,.6);
  for(let index=0;index<5;index++) {
    const base = INTRO_DURATION + FIRST_STACK_HOLD + index*PRODUCT_DURATION;
    assert.ok(galleryScene(base+settled-.05,INTRO_DURATION).detail<1);
    for(let i=0;i<=120;i++) assert.ok(Math.abs(galleryScene(base+settled+i/60,INTRO_DURATION).detail-1)<1e-10);
    assert.ok(galleryScene(base+settled+2.05,INTRO_DURATION).detail<1);
  }
});
test('detail zoom, hold and return remain sharp while slide transitions use motion blur', () => {
  const base = INTRO_DURATION + FIRST_STACK_HOLD;
  for(const local of [2.6,3.5,4.9,5.3]) {
    const time=base+local;
    assert.deepEqual(sceneShutterTimes(time,galleryScene(time,INTRO_DURATION)),[time]);
  }
  for(const local of [.2,1.2,2.05,5.8,6.2]) {
    const time=base+local;
    assert.equal(sceneShutterTimes(time,galleryScene(time,INTRO_DURATION)).length,5);
  }
});

test('each garment reveals front-facing and starts its own rotation only once visible', () => {
  for (const duration of [22,32,45]) for (let index=0; index<5; index++) {
    const at = local => galleryScene(3 + FIRST_STACK_HOLD + (index*PRODUCT_DURATION+local)*duration/GALLERY_DURATION,3,duration);
    for (const local of [0,2.46,2.75,3.05]) assert.ok(Math.abs(at(local).turn)<1e-10);
    assert.ok(at(3.25).turn>0);
    assert.ok(Math.abs(at(3.25).turn - .2*duration/GALLERY_DURATION*Math.PI*2/10)<1e-10);
  }
});

import { endingLayout } from '../../lib/album-v2-lineup.js';
import { paintDetailGrid } from '../../lib/album-v2-detail.js';
import { paintBecome } from '../../lib/album-v2-brand.js';
test('ending spacing and center align the entire branded group, including header and footer', () => {
  const crops=Array.from({length:5},()=>({w:350,h:1000}));
  for(const gap of [-60,-20,0,100]) {
    const layout=endingLayout(crops,{gap,x:50,y:50}), {bounds,models}=layout;
    assert.equal(bounds.x+bounds.width/2,540); assert.equal(bounds.y+bounds.height/2,960);
    for(let i=1;i<5;i++) assert.ok(Math.abs(models[i].x-models[i-1].x-models[i-1].width-gap)<1e-9);
    assert.ok(layout.logoY+53<models[0].y); assert.ok(layout.globeY-27>models[0].y+models[0].height);
  }
  const a=endingLayout(crops),b=endingLayout(crops,{x:40,y:60});
  assert.equal(b.x-a.x,-108); assert.ok(Math.abs(b.bounds.y-a.bounds.y-192)<1e-9);
  const labels=[],logos=[],ctx={save(){},restore(){},fillText(...args){labels.push(args)}};
  paintBecome(ctx,(...args)=>logos.push(args),b);
  assert.deepEqual(labels[0],['Become',b.x,b.becomeY]);
  assert.equal(logos[0][2],b.logoY); assert.equal(logos[1][2],b.globeY); assert.ok(logos.every(l=>l[3]===b.x));
});
test('detail grid uses larger square cells with F2 strokes and specified Geist typography', () => {
  const strokes=[],lines=[],texts=[];
  const ctx={save(){},restore(){},beginPath(){},moveTo(x,y){this.start=[x,y]},lineTo(x,y){lines.push([this.start,[x,y]])},stroke(){strokes.push(this.strokeStyle)},fillRect(){},drawImage(){},measureText(t){return {width:t.length*10}},fillText(t){texts.push({text:t,font:this.font,spacing:this.letterSpacing})}};
  paintDetailGrid(ctx); assert.deepEqual(strokes,['#f2f2f2']);
  assert.ok(lines.every(([a,b])=>a[0]===b[0] || a[1]===b[1]));
  assert.deepEqual(lines[1],[[120,0],[120,1920]]);
  assert.ok(lines.some(([a,b])=>a[1]===120 && b[1]===120));
  paintProductDetail(ctx,{}, {image:{width:1600,height:2400},crop:{x:450,y:80,w:700,h:2220}}, {productName:'Victor Doom Polo Sweatshirt Olive',type:'Polo Sweatshirt'},1);
  assert.deepEqual(texts[0],{text:'Victor Doom',font:'400 52px Geist, sans-serif',spacing:'-1.56px'});
  assert.deepEqual(texts[1],{text:'Polo Sweatshirt Olive',font:'100 34px Geist, sans-serif',spacing:'-0.68px'});
});

import { introBrand } from '../../lib/album-v2-artwork.js';
import { endingDefaults, endingControls, moveEnding } from '../../lib/album-v2-ending.js';
import { groupFontFamilies } from '../../lib/album-font-picker.js';
test('intro and ending match supplied artwork and typography defaults without synthetic controls', () => {
  const brand=introBrand(),labels=introLabels();
  assert.equal(brand.scale,.4); assert.equal(brand.y,.35); assert.equal(brand.variant,'wordmark'); assert.equal(brand.x,.5);
  assert.equal(labels[0].y,.49); assert.ok(brand.y<labels[0].y); assert.ok(labels[1].y>labels[0].y);
  assert.ok(labels.every(l=>l.weight===400 && l.italic===false));
  for(const markup of [introControls(),endingControls()]) {
    assert.ok(!markup.includes('data-text-weight')); assert.ok(!markup.includes('data-text-italic'));
    for(const key of ['data-font-upload','data-text-size','data-text-spacing','data-text-lineHeight','data-text-color','data-center-x','data-center-y','data-art-x','data-art-y','data-art-scale']) assert.ok(markup.includes(key),key);
  }
});
test('local font faces collapse under families, deduplicate and prefer real regular faces', () => {
  const groups=groupFontFamilies([
    {family:'Test Sans',style:'Bold',postscriptName:'test-bold'},
    {family:'Test Sans',style:'Regular',postscriptName:'test-regular'},
    {family:'Test Sans',style:'Bold',postscriptName:'test-bold'},
    {family:'Other',style:'Thin',postscriptName:'other-thin'},
  ]);
  assert.equal(groups.length,2); assert.equal(groups[1].faces.length,2); assert.equal(groups[1].faces[0].style,'Regular');
});
test('individual right gaps remain independent and group motion carries ending text and SVGs', () => {
  const settings=endingDefaults(),crops=Array.from({length:5},()=>({w:350,h:1000}));
  assert.deepEqual(settings.gaps,[-20,-20,-20,-20]); settings.gaps[1]=30;
  const {models}=endingLayout(crops,settings);
  models.slice(1).forEach((rect,i)=>assert.ok(Math.abs(rect.x-models[i].x-models[i].width-settings.gaps[i])<1e-9));
  const previous=settings.labels.map(l=>l.x); moveEnding(settings,'x',60);
  settings.labels.forEach((l,i)=>assert.ok(Math.abs(l.x-previous[i]-.1)<1e-9));
  assert.equal(settings.brand.x,.6); assert.equal(settings.link.x,.6);
  moveEnding(settings,'x',50); assert.equal(settings.brand.x,.5);
  assert.equal(GARMENT.x+GARMENT.size/2,754);
});

import { artworkRect } from '../../lib/album-v2-brand.js';
test('SVG selection bounds match rendered wordmark and globe geometry', () => {
  const intro=artworkRect(introBrand()), ending=endingDefaults();
  assert.equal(intro.w,780*.75*.4); assert.equal(intro.x+intro.w/2,540);
  const globe=artworkRect(ending.link); assert.equal(globe.w,375*.75);
  assert.equal(ending.brand.y,.3); assert.equal(ending.brand.scale,.75);
  assert.equal(ending.labels[0].y,.256); assert.equal(ending.labels[0].size,52);
  assert.equal(ending.labels[0].spacing,-1.5); assert.equal(ending.labels[0].lineHeight,1.2);
  assert.equal(introLabels()[1].y,.623); assert.equal(introLabels()[1].size,36);
});
test('ending branding appears at full opacity on its first frame', () => {
  const start=INTRO_DURATION+FIRST_STACK_HOLD+GALLERY_DURATION;
  assert.equal(galleryScene(start+3.149,INTRO_DURATION).logo,0);
  assert.equal(galleryScene(start+3.15,INTRO_DURATION).logo,1);
});

import { endingBrandScale, endingBrandPose, endingDuration, animationDefaults, ANIMATION_STYLES, paintEndingLayer } from '../../lib/album-v2-brand-motion.js';
test('ending branding starts larger and shrinks quickly to its final scale', () => {
  assert.equal(endingBrandScale(3.14), 0); assert.equal(endingBrandScale(3.15), 1.45);
  assert.ok(endingBrandScale(3.25) > 1 && endingBrandScale(3.25) < 1.2);
  const scales=Array.from({length:39},(_,i)=>endingBrandScale(3.15+i/100));
  assert.ok(scales.every((scale,i)=>scale>=1 && (!i || scale<=scales[i-1])));
  assert.equal(endingBrandScale(3.54),1); assert.equal(endingBrandScale(4.5),1);
  const calls=[],ctx={globalAlpha:1,save(){},restore(){},translate(...args){calls.push(args)},scale(...args){calls.push(args)}};
  paintEndingLayer(ctx,{x:.5,y:.3},{scale:.8,x:0,y:0,opacity:1},()=>calls.push('paint'));
  assert.deepEqual(calls,[[540,576],[.8,.8],[-540,-576],'paint']);
});

test('all eight entrances start correctly and settle at their exact final pose', () => {
  assert.equal(ANIMATION_STYLES.length,8);
  for(const [style] of ANIMATION_STYLES) {
    const a={...animationDefaults(),style,delay:.2,duration:.8};
    assert.equal(endingBrandPose(3.2,a).opacity,0);
    const start=endingBrandPose(3.35,a), end=endingBrandPose(4.2,a);
    assert.deepEqual(end,{scale:1,x:0,y:0,opacity:1});
    if(style==='scale-in')assert.ok(start.scale<1e-9);
    if(style==='scale-out')assert.ok(Math.abs(start.scale-1.45)<1e-9);
    if(style==='fade-in')assert.ok(start.opacity<1e-9);
    if(style==='instant')assert.deepEqual(start,end);
    if(style==='slide-left')assert.ok(start.x<0);
    if(style==='slide-right')assert.ok(start.x>0);
    if(style==='slide-top')assert.ok(start.y<0);
    if(style==='slide-bottom')assert.ok(start.y>0);
  }
});
test('easing, duration and travel sliders control deterministic intermediate poses', () => {
  const config={...animationDefaults(),style:'slide-left',duration:1,distance:50};
  assert.ok(Math.abs(endingBrandPose(3.65,{...config,easing:'linear'}).x+270)<1e-9);
  assert.ok(Math.abs(endingBrandPose(3.65,{...config,easing:'snappy'}).x+67.5)<1e-9);
  assert.ok(Math.abs(endingBrandPose(3.65,{...config,easing:'smooth'}).x+270)<1e-9);
  for(const [style] of ANIMATION_STYLES) for(const duration of [.1,.38,3]) for(const delay of [0,2]) {
    for(let time=0;time<9;time+=.05)assert.ok(Object.values(endingBrandPose(time,{style,duration,delay})).every(Number.isFinite));
  }
});
test('long or delayed layer animations extend the ending without changing the default total', () => {
  const ending=endingDefaults();assert.equal(endingDuration(ending),4.5);
  ending.brand.animation.duration=3;ending.brand.animation.delay=2;
  assert.equal(endingDuration(ending),8.55);
  assert.equal(ending.labels[0].animation.duration,.38);
  ending.brand.enabled=false;assert.equal(endingDuration(ending),4.5);
  ending.brand.enabled=true;ending.brand.animation.style='instant';
  assert.ok(Math.abs(endingDuration(ending)-5.55)<1e-9);
});
test('fade opacity reaches both text callbacks and artwork painting', () => {
  let seen;
  const ctx={globalAlpha:1,save(){},restore(){},translate(){},scale(){}};
  paintEndingLayer(ctx,{x:.5,y:.3},{scale:1,x:20,y:0,opacity:.4},opacity=>{seen=opacity;assert.equal(ctx.globalAlpha,.4)});
  assert.equal(seen,.4);
});
