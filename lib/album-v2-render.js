import * as THREE from 'three';
import { createAlbumProducts } from './album-product.js';
import { createLiquidGlass } from './album-v2-glass.js';
import { loadBrandArtwork } from './album-v2-brand.js';
import { paintLabel, labelMetrics } from './album-render.js';
import { splitTitle } from './shopify.js';
import { galleryScene, galleryCardPose, photoScene, shutterTimes, GALLERY_DURATION, GLASS, BAG } from './album-v2-motion.js';
const W = 1080, H = 1920;
const mix = (a, b, p) => a + (b - a) * p;
function cover(ctx, image, x, y, w, h) {
  const iw = image.videoWidth || image.width, ih = image.videoHeight || image.height;
  const scale = Math.max(w / iw, h / ih), sw = w / scale, sh = h / scale;
  ctx.drawImage(image, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
}
function rounded(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function pill(ctx, x, y, w, h, fill) { ctx.fillStyle = fill; rounded(ctx, x, y, w, h, h / 2); ctx.fill(); }
function bagButton(ctx, scene) {
  const inset = 16 / 390 * W, x = GLASS.x * W + inset, w = GLASS.w * W - inset * 2, h = BAG.height * W, y = (GLASS.y + GLASS.h) * H - inset - h;
  const split = scene.split, gap = BAG.gap * W * split, left = mix(w, (w - BAG.gap * W) * .3, split), right = w - left - gap, opacity = ctx.globalAlpha;
  ctx.save(); ctx.translate(x + w / 2, y + h / 2); const press = 1 - scene.press * .025; ctx.scale(press, press); ctx.translate(-w / 2, -h / 2);
  const tone = Math.round(mix(10, 248, split)); pill(ctx, 0, 0, left, h, `rgb(${tone},${tone},${tone})`);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '500 44px Geist, sans-serif';
  ctx.globalAlpha = opacity * (1 - split); ctx.fillStyle = '#fff'; ctx.fillText('Add to Bag', left / 2, h / 2);
  ctx.globalAlpha = opacity * split; ctx.fillStyle = '#808080'; ctx.fillText('Added', left / 2 - 30, h / 2);
  ctx.strokeStyle = '#808080'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(left / 2 + 47, h / 2); ctx.lineTo(left / 2 + 59, h / 2 + 12); ctx.lineTo(left / 2 + 83, h / 2 - 15); ctx.stroke();
  if (right > 1) {
    pill(ctx, left + gap, 0, right, h, '#0a0a0a');
    ctx.save(); rounded(ctx, left + gap, 0, right, h, h / 2); ctx.clip();
    ctx.fillStyle = '#fff'; ctx.fillText('Visit bag', left + gap + right / 2, h / 2); ctx.restore();
  }
  ctx.restore();
}
function titleLines(ctx, text, size, weight) {
  let lines;
  do {
    ctx.font = `${weight} ${size}px Geist, sans-serif`; lines = []; let line = '';
    for (const word of text.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > 820) { lines.push(line); line = word; } else line = next;
    }
    if (line) lines.push(line);
    if (lines.length <= 2 || size <= 26) break;
    size -= 2;
  } while (true);
  return { lines, size };
}
function glassCard(ctx, background, garment, asset, scene) {
  const alpha = scene.glass;
  if (alpha <= 0) return;
  const x = GLASS.x * W, y = GLASS.y * H, w = GLASS.w * W, h = GLASS.h * H;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(0, (1 - alpha) * 140);
  rounded(ctx, x, y, w, h, GLASS.radius * W); ctx.clip();
  if (garment) ctx.drawImage(garment, 210, y + 22, 660, 660);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = 10;
  const [name, subtitle] = splitTitle(asset.productName, asset.type);
  const main = titleLines(ctx, name, 54, 600), mainTop = main.lines.length > 1 ? 1438 : 1466;
  main.lines.forEach((line, i) => ctx.fillText(line, W / 2, mainTop + i * (main.size + 4), 820));
  const sub = titleLines(ctx, subtitle, 36, 400), subTop = mainTop + main.lines.length * (main.size + 4) + 4;
  sub.lines.forEach((line, i) => ctx.fillText(line, W / 2, subTop + i * (sub.size + 3), 820));
  ctx.shadowColor = 'transparent'; bagButton(ctx, scene); ctx.restore();
}
export async function createGalleryRenderer(assets, { width = 360, height = 640, preview = true } = {}) {
  const canvas = new OffscreenCanvas(width, height);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setSize(width, height, false); renderer.setClearColor(0x000000, 1); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene3d = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, width / height, .1, 100);
  const geometry = new THREE.PlaneGeometry(2, 3), meshes = [], textures = [], materials = [];
  const introCanvas = new OffscreenCanvas(W, H), introCtx = introCanvas.getContext('2d');
  let products, liquid;
  const photoCards = [];
  function addCard(photo, order) {
    const texture = new THREE.CanvasTexture(photo); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = renderer.capabilities.getMaxAnisotropy(); textures.push(texture);
    const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true }); materials.push(material);
    const mesh = new THREE.Mesh(geometry, material); mesh.userData.order = order;
    if (order === -1) mesh.scale.x = 27 / 32;
    scene3d.add(mesh); meshes.push(mesh); return texture;
  }
  function dispose() { liquid?.dispose(); products?.dispose(); textures.forEach(t => t.dispose()); materials.forEach(m => m.dispose()); geometry.dispose(); renderer.dispose(); renderer.forceContextLoss(); }
  try {
    const paintLogo = await loadBrandArtwork();
    const introTexture = addCard(introCanvas, -1);
    assets.forEach((asset, i) => {
      const photo = new OffscreenCanvas(preview ? 480 : 1200, preview ? 720 : 1800);
      photoCards.push({ canvas: photo, ctx: photo.getContext('2d'), texture: addCard(photo, i), key: '' });
    });
    products = await createAlbumProducts(assets, preview, preview ? { width: 360, height: 360 } : { width: 1000, height: 1000 });
    const shutter = new OffscreenCanvas(width, height), background = new OffscreenCanvas(width, height), output = new OffscreenCanvas(width, height);
    const bg = background.getContext('2d'), accum = shutter.getContext('2d'), ctx = output.getContext('2d');
    liquid = createLiquidGlass(renderer, background);
    function draw(time, { introDuration = 0, galleryDuration = GALLERY_DURATION, intro = null, labels = [], brand = {} } = {}) {
      const scene = galleryScene(time, introDuration, galleryDuration);
      if (scene.intro && intro) {
        cover(introCtx, intro.video, 0, 0, W, H);
        if (scene.labels) {
          for (const label of labels) {
            const metrics = labelMetrics(introCtx, label);
            paintLabel(introCtx, { ...label, size: label.size * Math.min(1, 920 / metrics.width, 280 / metrics.height) });
          }
          paintLogo(introCtx, brand);
        }
        introTexture.needsUpdate = true;
      }
      const garment = scene.glass > 0 ? products.render(assets[scene.index], scene.turn, .04) : null;
      const changing = value => value > 0 && value < 1;
      const moving = scene.intro || scene.outro || changing(scene.zoom) || changing(scene.glass)
        || scene.swipe > 0 || changing(scene.split) || scene.press > 0 || changing(photoScene(scene).progress);
      // Steady holds already get angular shutter samples from the garment renderer.
      const times = moving ? shutterTimes(time) : [time];
      for (let n = 0; n < times.length; n++) {
        const sample = galleryScene(times[n], introDuration, galleryDuration);
        meshes.forEach(mesh => {
          const order = mesh.userData.order, pose = galleryCardPose(order, sample); mesh.visible = pose.visible;
          if (!pose.visible) return;
          if (order >= 0) {
            const card = photoCards[order], asset = assets[order];
            const photo = order === sample.index ? photoScene(sample) : { from: order < sample.index ? 3 : 0, to: order < sample.index ? 3 : 0, progress: 0 };
            const key = `${photo.from}/${photo.to}/${photo.progress}`;
            if (key !== card.key) {
              const images = asset.photos?.map(item => item.image) || [asset.image];
              const from = images[photo.from] || images[0], to = images[photo.to] || images[0];
              const w = card.canvas.width, h = card.canvas.height, x = photo.progress * w;
              card.ctx.clearRect(0, 0, w, h);
              cover(card.ctx, from, x, 0, w, h);
              if (photo.from !== photo.to) cover(card.ctx, to, x - w, 0, w, h);
              card.texture.needsUpdate = true; card.key = key;
            }
          }
          mesh.position.set(pose.x, pose.y, pose.z); mesh.rotation.set(pose.rotateX, 0, pose.rotateZ);
          mesh.scale.set((order === -1 ? 27 / 32 : 1) * (pose.scale ?? 1), pose.scale ?? 1, 1);
          mesh.material.opacity = pose.opacity;
        });
        const fit = 1.5 / Math.tan(Math.PI / 9);
        camera.position.set(0, 0, sample.intro ? 6.6 : mix(6.6, fit, sample.zoom)); camera.lookAt(0, 0, 0);
        renderer.render(scene3d, camera);
        bg.filter = sample.glass > 0 ? `blur(${4 * sample.glass * width / W}px) saturate(${1 - .3 * sample.glass}) brightness(${1 - .25 * sample.glass})` : 'none';
        const pad = 6 * sample.glass * width / W;
        bg.drawImage(canvas, -pad, -pad, width + 2 * pad, height + 2 * pad); bg.filter = 'none';
        ctx.drawImage(sample.glass > 0 ? liquid.render(sample.glass) : background, 0, 0);
        if (sample.glass > 0 && garment && sample.index === scene.index) {
          ctx.save(); ctx.scale(width / W, height / H); glassCard(ctx, background, garment, assets[sample.index], sample); ctx.restore();
        }
        if (sample.outro && sample.logo > 0) {
          ctx.save(); ctx.scale(width / W, height / H); ctx.globalAlpha = sample.logo; paintLogo(ctx, brand); ctx.restore();
        }
        accum.globalAlpha = 1 / (n + 1); accum.drawImage(output, 0, 0);
      }
      accum.globalAlpha = 1;
      return shutter;
    }
    return { draw, dispose, setNames(names) { assets.forEach((asset, i) => { asset.productName = names[i]; }); } };
  } catch (error) { dispose(); throw error; }
}
