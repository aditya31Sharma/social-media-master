import * as THREE from 'three';
import { createAlbumProducts } from './album-product.js';
import { paintLabel } from './album-render.js';
import { splitTitle } from './shopify.js';
import { galleryScene, galleryCardPose, GLASS, BAG } from './album-v2-motion.js';
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
  const x = BAG.x * W, w = BAG.width * W, h = BAG.height * W, y = H - 48 - h;
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
      if (line && ctx.measureText(next).width > 940) { lines.push(line); line = word; } else line = next;
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
  ctx.save(); rounded(ctx, x, y, w, h, [48, 48, 0, 0]); ctx.clip();
  ctx.filter = `blur(${30 * ctx.getTransform().a}px) saturate(.5)`; ctx.drawImage(background, 0, 0, W, H); ctx.filter = 'none';
  const frost = ctx.createLinearGradient(x, y, x + w, y + h); frost.addColorStop(0, 'rgba(242,248,255,.54)'); frost.addColorStop(.5, 'rgba(228,238,249,.3)'); frost.addColorStop(1, 'rgba(224,236,255,.4)');
  ctx.fillStyle = frost; ctx.fillRect(x, y, w, h); ctx.restore();
  rounded(ctx, x + 1, y + 1, w - 2, h, [48, 48, 0, 0]); ctx.strokeStyle = 'rgba(255,255,255,.58)'; ctx.lineWidth = 2; ctx.stroke();
  if (garment) ctx.drawImage(garment, 180, 790, 720, 720);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = 10;
  const [name, subtitle] = splitTitle(asset.productName, asset.type);
  const main = titleLines(ctx, name, 58, 600), mainTop = main.lines.length > 1 ? 1495 : 1525;
  main.lines.forEach((line, i) => ctx.fillText(line, W / 2, mainTop + i * (main.size + 4), 940));
  const sub = titleLines(ctx, subtitle, 38, 400), subTop = mainTop + main.lines.length * (main.size + 4) + 4;
  sub.lines.forEach((line, i) => ctx.fillText(line, W / 2, subTop + i * (sub.size + 3), 940));
  ctx.shadowColor = 'transparent'; bagButton(ctx, scene); ctx.restore();
}
export async function createGalleryRenderer(assets, { width = 360, height = 640, preview = true } = {}) {
  const canvas = new OffscreenCanvas(width, height);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setSize(width, height, false); renderer.setClearColor(0x080a0d, 1); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene3d = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, width / height, .1, 100);
  const geometry = new THREE.PlaneGeometry(2, 3), meshes = [], textures = [], materials = [];
  const introCanvas = new OffscreenCanvas(W, H), introCtx = introCanvas.getContext('2d');
  let products;
  function addCard(photo, order) {
    const texture = new THREE.CanvasTexture(photo); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = renderer.capabilities.getMaxAnisotropy(); textures.push(texture);
    const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }); materials.push(material);
    const mesh = new THREE.Mesh(geometry, material); mesh.userData.order = order;
    if (order === -1) mesh.scale.x = 27 / 32;
    scene3d.add(mesh); meshes.push(mesh); return texture;
  }
  function dispose() { products?.dispose(); textures.forEach(t => t.dispose()); materials.forEach(m => m.dispose()); geometry.dispose(); renderer.dispose(); renderer.forceContextLoss(); }
  try {
    const introTexture = addCard(introCanvas, -1);
    assets.forEach((asset, i) => {
      const photo = new OffscreenCanvas(preview ? 480 : 1200, preview ? 720 : 1800);
      cover(photo.getContext('2d'), asset.image, 0, 0, photo.width, photo.height); addCard(photo, i);
    });
    products = await createAlbumProducts(assets, preview, preview ? { width: 360, height: 360 } : { width: 1000, height: 1000 });
    const shutter = new OffscreenCanvas(width, height), background = new OffscreenCanvas(width, height), output = new OffscreenCanvas(width, height);
    const bg = background.getContext('2d'), accum = shutter.getContext('2d'), ctx = output.getContext('2d');
    function draw(time, { introDuration = 0, galleryDuration = 23, intro = null, labels = [] } = {}) {
      const scene = galleryScene(time, introDuration, galleryDuration);
      if (scene.intro && intro) {
        cover(introCtx, intro.video, 0, 0, W, H);
        if (scene.labels) for (const label of labels) paintLabel(introCtx, label);
        introTexture.needsUpdate = true;
      }
      const moving = scene.zoom > 0 && scene.zoom < 1 || scene.swipe > 0;
      const samples = moving ? 5 : 1;
      for (let n = 0; n < samples; n++) {
        const sample = galleryScene(Math.max(0, time - n * .008 / 4), introDuration, galleryDuration);
        meshes.forEach(mesh => {
          const pose = galleryCardPose(mesh.userData.order, sample); mesh.visible = pose.visible;
          if (!pose.visible) return;
          mesh.position.set(pose.x, pose.y, pose.z); mesh.rotation.set(pose.rotateX, 0, pose.rotateZ);
        });
        const fit = sample.intro ? 1.5 / Math.tan(Math.PI / 9) : 1 / (camera.aspect * Math.tan(Math.PI / 9));
        camera.position.set(0, 0, mix(6.6, fit, sample.zoom)); camera.lookAt(0, 0, 0);
        renderer.render(scene3d, camera); accum.globalAlpha = 1 / (n + 1); accum.drawImage(canvas, 0, 0);
      }
      accum.globalAlpha = 1; bg.clearRect(0, 0, width, height);
      bg.filter = scene.glass > 0 ? `blur(${20 * scene.glass * width / W}px) saturate(${1 - .7 * scene.glass}) brightness(${1 - .45 * scene.glass})` : 'none';
      const pad = 24 * scene.glass * width / W;
      bg.drawImage(shutter, -pad, -pad, width + 2 * pad, height + 2 * pad); bg.filter = 'none'; ctx.drawImage(background, 0, 0);
      if (scene.glass > 0) {
        const asset = assets[scene.index], garment = products.render(asset, scene.turn, .012);
        ctx.save(); ctx.scale(width / W, height / H); glassCard(ctx, background, garment, asset, scene); ctx.restore();
      }
      return output;
    }
    return { draw, dispose, setNames(names) { assets.forEach((asset, i) => { asset.productName = names[i]; }); } };
  } catch (error) { dispose(); throw error; }
}
