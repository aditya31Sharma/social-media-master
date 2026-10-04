import * as THREE from 'three';
import { OutfitStage } from './stage3d.js';

// Reuse the outfit renderer's asset cache, fabric materials and Dramatic side rig.
// One transparent context serves every SKU; only the active garment is visible.
export class AlbumProductStage extends OutfitStage {
  constructor({ preview = true } = {}) {
    const width = preview ? 240 : 480, height = preview ? 360 : 720;
    super(width, height, { x: 0, y: 0, w: width, h: height }, height, height, {}, { preview });
    this.view = { ...this.box };
    this.entries = new Map();
    this.key.shadow.mapSize.set(preview ? 256 : 1024, preview ? 256 : 1024);
  }

  prepare(asset) {
    if (!asset.glb) return Promise.reject(new Error(`Choose a 3D garment for ${asset.productName || 'this model'}.`));
    if (this.entries.has(asset.glb)) return this.entries.get(asset.glb);
    const slot = `product-${this.entries.size}`;
    const promise = this.add(slot, asset.glb, asset.type || '').then(() => {
      const part = this.parts[slot];
      part.pivot.visible = false;
      const size = new THREE.Box3().setFromObject(part.pivot).getSize(new THREE.Vector3());
      // Fit the whole turn, including sleeves at oblique angles.
      const halfH = Math.max(size.y / 2, Math.hypot(size.x, size.z) / 2 * this.canvas.height / this.canvas.width) * 1.12;
      return { pivot: part.pivot, halfH };
    }).catch(error => { this.entries.delete(asset.glb); throw error; });
    this.entries.set(asset.glb, promise);
    return promise;
  }

  async ready(assets) {
    const results = await Promise.allSettled(assets.filter(asset => asset && asset.detailMode !== 'photo').map(asset => this.prepare(asset)));
    const failed = results.find(result => result.status === 'rejected');
    if (failed) throw failed.reason;
  }

  renderProduct(entry, turn) {
    for (const part of Object.values(this.parts)) part.pivot.visible = part.pivot === entry.pivot;
    const halfH = entry.halfH, halfW = halfH * this.canvas.width / this.canvas.height;
    Object.assign(this.camera, { left: -halfW, right: halfW, top: halfH, bottom: -halfH });
    this.camera.position.set(0, 0, 600); this.camera.lookAt(0, 0, 0); this.camera.updateProjectionMatrix();
    Object.assign(this.key.shadow.camera, { left: -halfW * 1.5, right: halfW * 1.5, top: halfH * 1.5, bottom: -halfH * 1.5, near: 1, far: 1600 });
    this.key.shadow.camera.updateProjectionMatrix();
    return this.render(turn);
  }
}

export async function createAlbumProducts(assets, preview = true, size = null) {
  if (assets.every(asset => !asset || asset.detailMode === 'photo')) return { render: () => null, dispose() {} };
  const stage = new AlbumProductStage({ preview });
  try {
    if (size) { stage.renderer.setSize(size.width, size.height, false); stage.view = { x: 0, y: 0, w: size.width, h: size.height }; }
    await stage.ready(assets);
    const entries = new Map();
    for (const asset of assets) if (asset && asset.detailMode !== 'photo') entries.set(asset.glb, await stage.prepare(asset));
    const blur = new OffscreenCanvas(stage.canvas.width, stage.canvas.height), ctx = blur.getContext('2d');
    return {
      render(asset, turn, blurAngle = .08) {
        const entry = entries.get(asset.glb); if (!entry) return null;
        // Three angular shutter samples preserve real rotational blur on the garment.
        ctx.clearRect(0, 0, blur.width, blur.height);
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 / 3;
        for (const offset of [-blurAngle, 0, blurAngle]) ctx.drawImage(stage.renderProduct(entry, turn + offset), 0, 0);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        return blur;
      },
      dispose() { stage.dispose(); if (!preview) stage.renderer.forceContextLoss(); },
    };
  } catch (error) { stage.dispose(); if (!preview) stage.renderer.forceContextLoss(); throw error; }
}
