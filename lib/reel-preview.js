import { OutfitStage } from './stage3d.js';
import { paintReelBackground } from './reel-background.js';

// The fit keeps its scene and GPU resources across adjustments. Exports create
// their own full-resolution stage from the original cached model assets.
export class FitPreview {
  constructor(canvas, onStatus) {
    this.canvas = canvas;
    this.onStatus = onStatus;
    this.version = 0;
    this.key = null;
    this.stage = null;
  }

  async update(top, bottom, tune, turn) {
    this.latest = { tune, turn };
    const key = JSON.stringify([top.glb, top.type, bottom.glb, bottom.type]);
    if (key === this.key) {
      if (this.stage) this.paint();
      return;
    }
    const version = ++this.version;
    this.key = key;
    this.stage?.dispose();
    this.stage = null;
    this.onStatus('loading');
    let stage;
    try {
      const { width: w, height: h } = this.canvas;
      const box = { x: 0, y: Math.round(h * .02), w, h: Math.round(h * .96) };
      stage = new OutfitStage(w, h, box, Math.round(h * 1.02), h, tune, { preview: true });
      // Settle both loads before disposing a superseded/failed stage.
      const loads = await Promise.allSettled([
        stage.add('top', top.glb, top.type),
        stage.add('bottom', bottom.glb, bottom.type),
      ]);
      if (version !== this.version) { stage.dispose(); return; }
      const failed = loads.find(result => result.status === 'rejected');
      if (failed) throw failed.reason;
      this.stage = stage;
      this.paint();
      this.onStatus('ready');
    } catch (error) {
      stage?.dispose();
      if (version !== this.version) return;
      this.key = null;
      this.stage = null;
      console.warn('Fit preview failed', error);
      this.onStatus('error');
    }
  }

  paint() {
    const { tune, turn } = this.latest;
    this.stage.setTune(tune);
    const { width, height } = this.canvas, g = this.canvas.getContext('2d');
    paintReelBackground(g, width, height);
    g.drawImage(this.stage.render(turn * Math.PI / 180), 0, 0);
  }
}
