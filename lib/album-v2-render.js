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
export async function createGalleryRenderer(assets, { width = 360, height = 640, preview = true } = {}) {
  const canvas = new OffscreenCanvas(width, height);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setSize(width, height, false); renderer.setClearColor(0x000000, 1); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene3d = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, width / height, .1, 100);
  const geometry = new THREE.PlaneGeometry(2, 3), meshes = [], textures = [], materials = [];
  const introCanvas = new OffscreenCanvas(W, H), introCtx = introCanvas.getContext('2d');
  let products;
  const photoCards = [];
  function addCard(photo, order) {
    const texture = new THREE.CanvasTexture(photo); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = renderer.capabilities.getMaxAnisotropy(); textures.push(texture);
    const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true }); materials.push(material);
    const mesh = new THREE.Mesh(geometry, material); mesh.userData.order = order;
    if (order === -1) mesh.scale.x = 27 / 32;
    scene3d.add(mesh); meshes.push(mesh); return texture;
  }
  function dispose() { products?.dispose(); textures.forEach(t => t.dispose()); materials.forEach(m => m.dispose()); geometry.dispose(); renderer.dispose(); renderer.forceContextLoss(); }
  try {
    const [paintLogo, lineup] = await Promise.all([loadBrandArtwork(), loadLineupArtwork(assets)]);
    const introTexture = addCard(introCanvas, -1);
    assets.forEach((asset, i) => {
      const photo = new OffscreenCanvas(preview ? 480 : 1200, preview ? 720 : 1800);
      photoCards.push({ canvas: photo, ctx: photo.getContext('2d'), texture: addCard(photo, i), key: '' });
    });
    products = await createAlbumProducts(assets, preview, preview ? { width: 360, height: 360 } : { width: 1000, height: 1000 });
    const shutter = new OffscreenCanvas(width, height), background = new OffscreenCanvas(width, height), output = new OffscreenCanvas(width, height);
    const bg = background.getContext('2d'), accum = shutter.getContext('2d'), ctx = output.getContext('2d');
    function draw(time, { introDuration = 0, galleryDuration = GALLERY_DURATION, intro = null, labels = [], brand = {} } = {}) {
      const scene = galleryScene(time, introDuration, galleryDuration);
      if (scene.intro && intro) {
        cover(introCtx, intro.video, 0, 0, W, H);
        if (scene.labels) {
          for (const label of labels) paintLabel(introCtx, label);
          paintLogo(introCtx, brand);
        }
        introTexture.needsUpdate = true;
      }
      const garment = scene.detail > 0 ? products.render(assets[scene.index], scene.turn, 0) : null;
      // Detail zoom/translation and garment rotation stay sharp; slides retain blur.
      const times = sceneShutterTimes(time, scene);
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
          ctx.save(); ctx.scale(width / W, height / H); ctx.globalAlpha = sample.lineup; lineup.paint(ctx, sample.local); ctx.restore();
        }
        if (sample.outro && sample.logo > 0) {
          ctx.save(); ctx.scale(width / W, height / H); ctx.globalAlpha = sample.logo; paintBecome(ctx, paintLogo); ctx.restore();
        }
        accum.globalAlpha = 1 / (n + 1); accum.drawImage(output, 0, 0);
      }
      accum.globalAlpha = 1;
      return shutter;
    }
    return { draw, dispose, setNames(names) { assets.forEach((asset, i) => { asset.productName = names[i]; }); } };
  } catch (error) { dispose(); throw error; }
}
