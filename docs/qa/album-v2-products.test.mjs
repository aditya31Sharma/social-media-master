import { test } from 'node:test';
import assert from 'node:assert/strict';
import { productDescriptor, loadReplacement } from '../../lib/album-v2-products.js';
const product = { handle: 'new-product', title: 'New product', glb: 'https://example.com/new.glb', byName: Object.fromEntries(['Shoot-1','Macro-Front','Model-Man-Front-Full','Model-Woman-Front-Full'].map(name => [name,{url:`https://example.com/${name}.webp`}])) };
test('replacement selects new product photos and matching GLB including full-length models', () => {
 const d=productDescriptor(product); assert.equal(d.glb,product.glb); assert.equal(d.photos.length,4); assert.match(d.photos[2].file,/Man-Front-Full/); assert.match(d.photos[3].file,/Woman-Front-Full/);
});
test('missing GLB rejects instead of reusing previous garment', () => {
 assert.throws(()=>productDescriptor({...product,glb:null}),/No 3D garment/);
});
test('replacement fetches and parses selected GLB, and creates both gender cutouts', async () => {
 const calls=[];const asset=await loadReplacement('new-product',{readProduct:async h=>{assert.equal(h,product.handle);return product;},loadModel:async url=>calls.push(url),loadShoot:async d=>({...d,photos:d.photos.map(p=>({...p,image:{src:p.file}}))}),cutoutPerson:async image=>({image:{src:image.src},crop:{w:1,h:2}})});
 assert.deepEqual(calls,[product.glb]);assert.equal(asset.handle,product.handle);assert.match(asset.people.man.image.src,/Man-Front-Full/);assert.match(asset.people.woman.image.src,/Woman-Front-Full/);
});
test('GLB failure prevents replacement images from loading', async () => {
 let photos=false;await assert.rejects(loadReplacement('new-product',{readProduct:async()=>product,loadModel:async()=>{throw Error('download failed');},loadShoot:async()=>{photos=true;}}),/download failed/);assert.equal(photos,false);
});
test('failed cutout releases newly allocated media', async () => {
 let closed=0,n=0;await assert.rejects(loadReplacement('new-product',{readProduct:async()=>product,loadModel:async()=>{},loadShoot:async d=>({...d,photos:d.photos.map(p=>({...p,image:{close(){closed++;}}}))}),cutoutPerson:async()=>{if(n++)throw Error('cutout failed');return {image:{close(){closed++;}}};}}),/cutout failed/);assert.equal(closed,5);
});

test('preview requests smaller photos while export retains original URLs', async () => {
 const asset = await loadReplacement('new-product', {readProduct:async()=>product,loadModel:async()=>{},loadShoot:async d=>{assert.ok(d.photos.every(p=>p.file.endsWith('?width=1280')));return {...d,photos:d.photos.map(p=>({...p,image:{}}))};},cutoutPerson:async()=>({image:{},crop:{w:1,h:1}})});
 assert.ok(asset.photos.every(p=>!p.file.includes('?width=')));
 assert.equal(asset.glb,product.glb);
});
