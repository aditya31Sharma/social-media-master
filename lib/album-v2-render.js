import { drawIntro } from './intro-crop.js';
import { editorShutterTimes } from './editor-performance.js';
import { endingBrandPose, paintEndingLayer } from './album-v2-brand-motion.js';
import * as THREE from 'three';
import { createAlbumProducts } from './album-product.js';
import { paintProductDetail } from './album-v2-detail.js';
import { loadLineupArtwork } from './album-v2-lineup.js';
import { loadBrandArtwork, paintBecome } from './album-v2-brand.js';
import { paintLabel } from './album-render.js';
import { galleryScene, galleryCardPose, photoScene, sceneShutterTimes, GALLERY_DURATION, OVERVIEW_DISTANCE, frontPhotoIndex } from './album-v2-motion.js';
const W = 1080, H = 1920;
const mix = (a, b, p) => a + (b - a) * p;
function cover(ctx, image, x, y, w, h) {
  const iw = image.videoWidth || image.width, ih = image.videoHeight || image.height;
  const scale = Math.max(w / iw, h / ih), sw = w / scale, sh = h / scale;
  ctx.drawImage(image, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
}
export async function createGalleryRenderer(assets, { width = 360, height = 640, preview = true, deferProducts = false } = {}) {
  const canvas = new OffscreenCanvas(width, height);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setSize(width, height, false); renderer.setClearColor(0x000000, 1); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene3d = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, width / height, .1, 100);
  const geometry = new THREE.PlaneGeometry(2, 3), meshes = [], textures = [], materials = [];
  const introCanvas = new OffscreenCanvas(preview ? width : W, preview ? height : H), introCtx = introCanvas.getContext('2d');
  introCtx.scale(introCanvas.width / W, introCanvas.height / H);
  let introKey = '', introSource = null;
  let products, disposed = false;
  const photoCards = [];
  function addCard(photo, order) {
    const texture = new THREE.CanvasTexture(photo); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = renderer.capabilities.getMaxAnisotropy(); textures.push(texture);
    const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true }); materials.push(material);
    const mesh = new THREE.Mesh(geometry, material); mesh.userData.order = order;
    if (order === -1) mesh.scale.x = 27 / 32;
    scene3d.add(mesh); meshes.push(mesh); return texture;
  }
  function dispose() { disposed = true; products?.dispose(); textures.forEach(t => t.dispose()); materials.forEach(m => m.dispose()); geometry.dispose(); renderer.dispose(); renderer.forceContextLoss(); }
  try {
    const [paintLogo, lineup] = await Promise.all([loadBrandArtwork(), loadLineupArtwork(assets, { preview })]);
    const introTexture = addCard(introCanvas, -1);
    assets.forEach((asset, i) => {
      const photo = new OffscreenCanvas(preview ? 480 : 1200, preview ? 720 : 1800);
      photoCards.push({ canvas: photo, ctx: photo.getContext('2d'), texture: addCard(photo, i), key: '' });
    });
    const ready = createAlbumProducts(assets, preview, preview ? { width: 360, height: 360 } : { width: 1000, height: 1000 }).then(next => {
      if (disposed) next.dispose(); else products = next;
    });
    if (!deferProducts) await ready;
    else ready.catch(() => {}); // The editor reports this through the exposed readiness promise.
    const shutter = new OffscreenCanvas(width, height), background = new OffscreenCanvas(width, height), output = new OffscreenCanvas(width, height);
    const bg = background.getContext('2d'), accum = shutter.getContext('2d'), ctx = output.getContext('2d');
    function draw(time, { introDuration = 0, galleryDuration = GALLERY_DURATION, intro = null, introCrop, labels = [], brand = {}, ending = {} } = {}) {
      const scene = galleryScene(time, introDuration, galleryDuration);
      if (intro !== introSource) { introSource = intro; introKey = ''; }
      const nextIntroKey = scene.intro && intro ? JSON.stringify([intro.video.currentTime, introCrop, scene.labels ? labels : null, scene.labels ? brand : null]) : '';
      if (nextIntroKey && nextIntroKey !== introKey) {
        introKey = nextIntroKey;
        drawIntro(introCtx, intro.video, introCrop, W, H);
        if (scene.labels) {
          for (const label of labels) paintLabel(introCtx, label);
          paintLogo(introCtx, brand);
        }
        introTexture.needsUpdate = true;
      }
      const garment = scene.detail > 0 ? products?.render(assets[scene.index], scene.turn, 0) : null;
      // Detail zoom/translation and garment rotation stay sharp; slides retain blur.
      const times = editorShutterTimes(sceneShutterTimes(time, scene), preview);
      for (let n = 0; n < times.length; n++) {
        const sample = galleryScene(times[n], introDuration, galleryDuration);
        meshes.forEach(mesh => {
          const order = mesh.userData.order, pose = galleryCardPose(order, sample); mesh.visible = pose.visible;
          if (!pose.visible) return;
          if (order >= 0) {
            const card = photoCards[order], asset = assets[order];
            const photo = order === sample.index ? photoScene(sample) : { from: order < sample.index ? frontPhotoIndex(order) : 0, to: order < sample.index ? frontPhotoIndex(order) : 0, progress: 0 };
            const key = `${photo.from}/${photo.to}/${photo.progress}`;
            if (key !== card.key) {
              const images = asset.photos?.map(item => item.image) || [asset.image];
              const from = images[photo.from] || images[0], to = images[photo.to] || images[0];
              const w = card.canvas.width, h = card.canvas.height, x = -photo.progress * w;
              card.ctx.clearRect(0, 0, w, h);
              cover(card.ctx, from, x, 0, w, h);
              if (photo.from !== photo.to) cover(card.ctx, to, x + w, 0, w, h);
              card.texture.needsUpdate = true; card.key = key;
            }
          }
          mesh.position.set(pose.x, pose.y, pose.z); mesh.rotation.set(pose.rotateX, 0, pose.rotateZ);
          mesh.scale.set((order === -1 ? 27 / 32 : 1) * (pose.scale ?? 1), pose.scale ?? 1, 1);
          mesh.material.opacity = pose.opacity;
        });
        const fit = 1.5 / Math.tan(Math.PI / 9);
        camera.position.set(0, 0, sample.intro ? OVERVIEW_DISTANCE : mix(OVERVIEW_DISTANCE, fit, sample.zoom)); camera.lookAt(0, 0, 0);
        renderer.setClearColor(sample.outro ? 0xffffff : 0x000000, 1);
        renderer.render(scene3d, camera);
        bg.drawImage(canvas, 0, 0, width, height);
        ctx.drawImage(background, 0, 0);
        if (sample.detail > 0 && garment && sample.index === scene.index) {
          ctx.save(); ctx.scale(width / W, height / H);
          paintProductDetail(ctx, garment, lineup.models[sample.index], assets[sample.index], sample.detail);
          ctx.restore();
        }
        if (sample.outro && sample.lineup > 0) {
          ctx.save(); ctx.scale(width / W, height / H); ctx.globalAlpha = sample.lineup; lineup.paint(ctx, sample.local, ending); ctx.restore();
        }
        accum.globalAlpha = 1 / (n + 1); accum.drawImage(output, 0, 0);
      }
      accum.globalAlpha = 1;
      // Keep the branding pop crisp and anchor each layer at its edited position.
      if (scene.outro && scene.logo > 0) {
        accum.save(); accum.scale(width / W, height / H);
        if (ending.labels) {
          for (const label of ending.labels) paintEndingLayer(accum, label, endingBrandPose(scene.local, label.animation), opacity => paintLabel(accum, label, opacity));
          for (const artwork of [ending.brand, ending.link]) paintEndingLayer(accum, artwork, endingBrandPose(scene.local, artwork.animation), () => paintLogo(accum, artwork));
        } else paintBecome(accum, paintLogo, lineup.layout(ending));
        accum.restore();
      }
      return shutter;
    }
    return { draw, dispose, ready, endingLayout: options => lineup.layout(options), setNames(names) { assets.forEach((asset, i) => { asset.productName = names[i]; }); } };
  } catch (error) { dispose(); throw error; }
}
