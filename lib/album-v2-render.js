import * as THREE from 'three';
import { createAlbumProducts } from './album-product.js';
import { galleryScene, galleryCardPose, GLASS } from './album-v2-motion.js';
const W = 1080, H = 1920;
const mix = (a, b, p) => a + (b - a) * p;
function cover(ctx, image, x, y, w, h) {
  const iw = image.videoWidth || image.width, ih = image.videoHeight || image.height;
  const scale = Math.max(w / iw, h / ih), sw = w / scale, sh = h / scale;
  ctx.drawImage(image, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
}
function rounded(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function nameLines(ctx, title) {
  const lines = []; let line = '';
  for (const word of title.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > 780) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line); return lines;
}
function pill(ctx, x, y, w, h, fill) { ctx.fillStyle = fill; rounded(ctx, x, y, w, h, h / 2); ctx.fill(); }
function bagButton(ctx, scene) {
  const x = 150, y = 1545, w = 780, h = 114, split = scene.split, gap = 20 * split;
  const left = mix(w, (w - 20) * .3, split), right = w - left - gap, opacity = ctx.globalAlpha;
  ctx.save(); ctx.translate(x + w / 2, y + h / 2); const press = 1 - scene.press * .04; ctx.scale(press, press); ctx.translate(-w / 2, -h / 2);
  const tone = Math.round(mix(10, 248, split)); pill(ctx, 0, 0, left, h, `rgb(${tone},${tone},${tone})`);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '500 35px "Plus Jakarta Sans", sans-serif';
  ctx.globalAlpha = opacity * (1 - split); ctx.fillStyle = '#ffffff'; ctx.fillText('Add to Bag', left / 2, h / 2);
  ctx.globalAlpha = opacity * split; ctx.fillStyle = '#808080'; ctx.fillText('Added', left / 2 - 25, h / 2);
  ctx.strokeStyle = '#808080'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(left / 2 + 43, h / 2); ctx.lineTo(left / 2 + 53, h / 2 + 10); ctx.lineTo(left / 2 + 72, h / 2 - 12); ctx.stroke();
  if (right > 1) {
    pill(ctx, left + gap, 0, right, h, '#0a0a0a');
    ctx.save(); rounded(ctx, left + gap, 0, right, h, h / 2); ctx.clip();
    ctx.fillStyle = '#ffffff'; ctx.fillText('Visit bag', left + gap + right / 2, h / 2); ctx.restore();
  }
  ctx.restore();
  if (scene.cursor > 0) {
    const cx = mix(980, 565, scene.click), cy = mix(1810, 1610, scene.click);
    ctx.save(); ctx.globalAlpha = opacity * scene.cursor; ctx.translate(cx, cy); ctx.scale(1 - scene.press * .15, 1 - scene.press * .15);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 48); ctx.lineTo(13, 35); ctx.lineTo(25, 60); ctx.lineTo(35, 55); ctx.lineTo(23, 31); ctx.lineTo(43, 31); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}
function glassCard(ctx, background, garment, asset, scene) {
  const { glass: alpha } = scene;
  if (alpha <= 0) return;
  const x = GLASS.x * W, y = GLASS.y * H, w = GLASS.w * W, h = GLASS.h * H;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(W / 2, H / 2 + (1 - alpha) * 100); const scale = .94 + .06 * alpha; ctx.scale(scale, scale); ctx.translate(-W / 2, -H / 2);
  ctx.shadowColor = 'rgba(0,0,0,.32)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 24;
  rounded(ctx, x, y, w, h, 58); ctx.fillStyle = 'rgba(230,240,250,.16)'; ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.save(); rounded(ctx, x, y, w, h, 58); ctx.clip();
  ctx.filter = `blur(${30 * ctx.getTransform().a}px) saturate(.5)`; ctx.drawImage(background, 0, 0, W, H); ctx.filter = 'none';
  const frost = ctx.createLinearGradient(x, y, x + w, y + h); frost.addColorStop(0, 'rgba(242,248,255,.54)'); frost.addColorStop(.5, 'rgba(228,238,249,.3)'); frost.addColorStop(1, 'rgba(224,236,255,.4)');
  ctx.fillStyle = frost; ctx.fillRect(x, y, w, h);
  const glow = ctx.createRadialGradient(W / 2, 650, 60, W / 2, 700, 750); glow.addColorStop(0, 'rgba(255,255,255,.3)'); glow.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = glow; ctx.fillRect(x, y, w, h);
  ctx.restore(); rounded(ctx, x, y, w, h, 58); ctx.strokeStyle = 'rgba(255,255,255,.58)'; ctx.lineWidth = 2; ctx.stroke();
  if (garment) ctx.drawImage(garment, 140, 280, 800, 960);
  ctx.fillStyle = '#fff'; ctx.font = '600 47px "Plus Jakarta Sans", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 2;
  const lines = nameLines(ctx, asset.productName);
  lines.forEach((line, i) => ctx.fillText(line, W / 2, 1345 + (i - (lines.length - 1) / 2) * 62, 790));
  ctx.shadowColor = 'transparent'; bagButton(ctx, scene); ctx.restore();
}
export async function createGalleryRenderer(assets, { width = 360, height = 640, preview = true } = {}) {
  const canvas = new OffscreenCanvas(width, height);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setSize(width, height, false); renderer.setClearColor(0x080a0d, 1); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene3d = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, width / height, .1, 100);
  const geometry = new THREE.PlaneGeometry(2, 3), meshes = [], textures = [], materials = [];
  let products;
  function dispose() { products?.dispose(); textures.forEach(t => t.dispose()); materials.forEach(m => m.dispose()); geometry.dispose(); renderer.dispose(); renderer.forceContextLoss(); }
  try {
    assets.forEach(asset => {
      const photo = new OffscreenCanvas(preview ? 480 : 1200, preview ? 720 : 1800);
      cover(photo.getContext('2d'), asset.image, 0, 0, photo.width, photo.height);
      const texture = new THREE.CanvasTexture(photo); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = renderer.capabilities.getMaxAnisotropy(); textures.push(texture);
      const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide }); materials.push(material);
      const mesh = new THREE.Mesh(geometry, material); scene3d.add(mesh); meshes.push(mesh);
    });
    products = await createAlbumProducts(assets, preview, preview ? { width: 320, height: 384 } : { width: 960, height: 1152 });
    const shutter = new OffscreenCanvas(width, height), background = new OffscreenCanvas(width, height), output = new OffscreenCanvas(width, height);
    const bg = background.getContext('2d'), accum = shutter.getContext('2d'), ctx = output.getContext('2d');
    function draw(time, { introDuration = 0, galleryDuration = 23, intro = null } = {}) {
      const scene = galleryScene(time, introDuration, galleryDuration);
      if (scene.intro && intro) { ctx.filter = 'none'; cover(ctx, intro.video, 0, 0, width, height); return output; }
      // Flat frames remain sharp; seven shutter samples make flips and camera moves visibly blur.
      const moving = scene.zoom > 0 && scene.zoom < 1 || scene.swipe > 0;
      const samples = moving ? 7 : 1;
      for (let n = 0; n < samples; n++) {
        const sample = galleryScene(Math.max(introDuration, time - n * .06 / 6), introDuration, galleryDuration);
        meshes.forEach((mesh, i) => {
          const pose = galleryCardPose(i, sample); mesh.visible = pose.visible;
          if (!pose.visible) return;
          mesh.position.set(pose.x, pose.y, pose.z); mesh.rotation.set(pose.rotateX, 0, pose.rotateZ); mesh.material.opacity = pose.opacity;
        });
        camera.position.set(0, 0, mix(6.6, 3 / (2 * Math.tan(Math.PI / 9)), sample.zoom)); camera.lookAt(0, 0, 0);
        renderer.render(scene3d, camera); accum.globalAlpha = 1 / (n + 1); accum.drawImage(canvas, 0, 0);
      }
      accum.globalAlpha = 1;
      bg.clearRect(0, 0, width, height);
      bg.filter = scene.glass > 0 ? `blur(${20 * scene.glass * width / W}px) saturate(${1 - .7 * scene.glass}) brightness(${1 - .45 * scene.glass})` : 'none';
      // Slight overscan keeps the filtered photo from exposing empty edges.
      const pad = 24 * scene.glass * width / W;
      bg.drawImage(shutter, -pad, -pad, width + 2 * pad, height + 2 * pad); bg.filter = 'none';
      ctx.drawImage(background, 0, 0);
      if (scene.glass > 0) {
        const asset = assets[scene.index], garment = products.render(asset, scene.turn);
        ctx.save(); ctx.scale(width / W, height / H); glassCard(ctx, background, garment, asset, scene); ctx.restore();
      }
      return output;
    }
    return { draw, dispose, setNames(names) { assets.forEach((asset, i) => { asset.productName = names[i]; }); } };
  } catch (error) { dispose(); throw error; }
}
