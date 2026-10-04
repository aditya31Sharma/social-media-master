/* The outfit, in three dimensions.

   Both garments live in ONE scene at their real relative sizes and turn
   together as a single group. That is the whole design: they used to be fitted
   to their own boxes independently, which is why a pair of trousers came out
   the size of a torso. The GLBs cannot settle it between themselves - they are
   normalised individually, so a tee is 0.700 units tall and sweatpants 1.903 -
   so the scale comes from real garment lengths instead (garment-scale.js) and
   one world unit is one centimetre.

   Orthographic, because a perspective camera makes a turning garment breathe
   and the board's box is fixed. */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { lengthOf, liftOf } from './garment-scale.js';
import { FABRIC, FIT } from './reel-geom.js';
import { lightingFor } from './reel-lighting.js';

const DRACO_PATH = 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/';

const TONES = {
  aces: THREE.ACESFilmicToneMapping, neutral: THREE.NeutralToneMapping,
  reinhard: THREE.ReinhardToneMapping, none: THREE.NoToneMapping,
};

let loader = null;
function gltfLoader() {
  if (loader) return loader;
  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_PATH);      // the trousers ship draco-compressed
  loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  return loader;
}

const cache = new Map();
export async function loadModel(url) {
  if (cache.has(url)) return cache.get(url);
  const p = gltfLoader().loadAsync(url).then(g => g.scene);
  cache.set(url, p);
  return p;
}

/* Widest projection through a full turn over the width facing front. The
   viewport is padded by this so a garment three-quarters round has somewhere
   to go instead of being clipped. */
function swellOf(size) {
  return Math.hypot(size.x, size.z) / Math.max(size.x, 1e-6);
}

export class OutfitStage {
  /* `box` is the outfit's rectangle on the board, in render pixels. */
  /* `hemPx` is where the trouser hem should land, in render pixels from the
     top. It sits below the canvas, so the hem runs off the bottom edge. */
  /* `tune` carries the top preset and manual fit adjustments before a
     render: its size, orientation and where it sits. The bottom is never touched -
     it is anchored to the hem, and moving it would undo that. */
  constructor(width, height, box, hemPx, frameH, tune = {}) {
    const light = lightingFor(tune.lighting);
    this.light = light;
    this.materials = new Set();
    this.canvas = new OffscreenCanvas(width, height);
    const r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    r.setSize(width, height, false);
    r.setClearColor(0x000000, 0);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = TONES[light.tone] ?? THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = light.exposure;
    r.shadowMap.enabled = light.shadows;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.autoClear = false;
    this.renderer = r;

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(r);
    const room = new RoomEnvironment();
    this.environment = pmrem.fromScene(room, 0.04);
    this.scene.environment = this.environment.texture;
    room.dispose();
    pmrem.dispose();
    this.scene.environmentIntensity = light.env;

    const d = 300;                              // cm; the lights sit well clear
    const az = light.keyAz * Math.PI / 180, el = light.keyEl * Math.PI / 180;
    this.key = new THREE.DirectionalLight(light.keyColor ?? 0xffffff, light.key);
    this.key.position.set(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d);
    this.key.castShadow = light.shadows;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.bias = -0.0012;
    this.key.shadow.normalBias = 0.02;

    const fill = new THREE.DirectionalLight(light.fillColor ?? 0xffffff, light.fill);
    fill.position.set(-Math.sin(az) * d * 0.7, 40, Math.cos(az) * d * 0.7 + 120);
    const rim = new THREE.DirectionalLight(light.rimColor ?? 0xffffff, light.rim);
    rim.position.set(Math.sin(az + Math.PI) * d, 90, -d * 0.8);
    const amb = new THREE.AmbientLight(0xffffff, light.ambient);
    this.scene.add(this.key, this.key.target, fill, fill.target, rim, rim.target, amb);

    this.outfit = new THREE.Group();
    this.scene.add(this.outfit);

    this.box = box;
    this.hemPx = hemPx;
    /* Measured against the frame, so redrawing the board cannot rescale the
       garments as a side effect. */
    this.frameH = frameH ?? height;
    this.tune = { topScale: 1, topY: 0, topX: 0, topZ: 0, topTurn: 0, ...tune };
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -2000, 2000);
    this.parts = {};
  }

  async add(which, url, type) {
    const src = await loadModel(url);
    const obj = src.clone(true);
    const bb = new THREE.Box3().setFromObject(obj);
    const size = bb.getSize(new THREE.Vector3());
    const centre = bb.getCenter(new THREE.Vector3());
    /* Re-centred on itself so the turn is about the garment's own axis rather
       than wherever the exporter left the origin. */
    obj.position.set(-centre.x, -centre.y, -centre.z);
    obj.traverse(n => {
      if (!n.isMesh) return;
      n.castShadow = true; n.receiveShadow = true;
      // Object3D.clone shares materials with the cached GLB. Own the copies so
      // repeated fit changes never add roughness to the source again.
      const copyMaterial = source => {
        if (!source) return source;
        const m = source.clone();
        this.materials.add(m);
        /* Adjusted FROM the asset's own value, so fabrics authored differently
           do not collapse to the same finish. */
        m.roughness = Math.min(1, Math.max(0.05, (m.roughness ?? 1) + FABRIC.roughness));
        m.envMapIntensity = this.light.envMat;
        if ('sheen' in m) { m.sheen = FABRIC.sheen; m.sheenRoughness = 0.85; }
        for (const value of Object.values(m)) {
          if (!value?.isTexture) continue;
          const anisotropy = this.renderer.capabilities.getMaxAnisotropy();
          if (value.anisotropy !== anisotropy) {
            value.anisotropy = anisotropy;
            value.needsUpdate = true;
          }
        }
        return m;
      };
      n.material = Array.isArray(n.material) ? n.material.map(copyMaterial) : copyMaterial(n.material);
    });

    const pivot = new THREE.Object3D();
    pivot.add(obj);
    if (which === 'top') pivot.rotation.y = this.tune.topTurn * Math.PI / 180;
    /* One centimetre per unit: whatever the file's own scale was, the garment
       now measures what the garment measures. */
    const cm = lengthOf(type) * (which === 'top' ? this.tune.topScale : 1);
    pivot.scale.setScalar(cm / size.y);
    this.outfit.add(pivot);
    this.parts[which] = { pivot, cm, swell: swellOf(size), lift: liftOf(type) };
    return this;
  }

  /* Called once both garments are in. */
  layout() {
    const t = this.parts.top, b = this.parts.bottom;
    if (!t || !b) throw new Error('the outfit needs a top and a bottom');

    const totalCm = t.cm + b.cm - FIT.overlap;

    const pad = Math.ceil(this.box.w * (Math.max(t.swell, b.swell) - 1) / 2) + 2;
    this.view = { x: this.box.x - pad, y: this.box.y, w: this.box.w + pad * 2, h: this.box.h };

    /* The camera frames whatever slice of the world the view box covers at the
       frame's own scale, so the box's size changes what is SEEN, never how big
       the garments are. `groupScale` treats the pair as one object: a tighter
       view enlarges both together and leaves their relationship alone. */
    const ppc = this.frameH / (FIT.fitCm / FIT.groupScale);
    const halfH = this.view.h / 2 / ppc;
    const halfW = this.view.w / 2 / ppc;

    /* Anchored by the hem. World y = 0 projects to the middle of the view, so
       the drop needed to put the hem at hemPx is the distance between those
       two, converted from pixels to centimetres. */
    const midPx = this.view.y + this.view.h / 2;
    /* The pair is lifted as one, by a fraction of the frame rather than a
       number of centimetres, so it holds at any export size. */
    const hemPx = this.hemPx - this.frameH * FIT.groupRise;
    const hemY = (midPx - hemPx) / ppc;               // world cm
    const lift = hemY + totalCm / 2 + FIT.nudge;      // moves the hung outfit onto it

    const topY = totalCm / 2 - t.cm / 2;
    const botY = totalCm / 2 - t.cm + FIT.overlap - b.cm / 2;
    /* A hair of z either way so the top always resolves in front of the
       waistband rather than depending on draw order. */
    /* topZ pushes the top back in depth so the two line up in profile; the
       0.1 either side only settles which resolves in front. */
    const zBack = FIT.topZ * FIT.fitCm;
    /* A cropped top is raised off the waistband; everything else lifts by 0. */
    this.home = {
      top: new THREE.Vector3(0, topY + lift + t.lift, zBack + 0.1),
      bottom: new THREE.Vector3(0, botY + lift, -0.1),
    };
    /* The top's own nudge, in centimetres, up positive. */
    this.home.top.x += this.tune.topX;
    this.home.top.y += this.tune.topY;
    this.home.top.z += this.tune.topZ;
    t.pivot.position.copy(this.home.top);
    b.pivot.position.copy(this.home.bottom);
    /* How far off-frame each one starts, for the opening. A fifth more than
       the view is tall, so the first frame is genuinely empty rather than
       showing a sliver of hood at the top edge. */
    this.offstage = (this.view.h / ppc) * 1.25;
    Object.assign(this.camera, { left: -halfW, right: halfW, top: halfH, bottom: -halfH });
    this.camera.position.set(0, 0, 600);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();

    const s = this.key.shadow.camera;
    Object.assign(s, { left: -halfW * 1.5, right: halfW * 1.5, top: halfH * 1.5, bottom: -halfH * 1.5, near: 1, far: 1600 });
    s.updateProjectionMatrix();
    return this;
  }

  /* The opening: 0 puts the top above the frame and the trousers below it, 1
     is where they belong. Moved in world space rather than by shifting the
     viewport, so the two travel independently and the camera never moves. */
  setEntry(k) {
    const t = this.parts.top, b = this.parts.bottom;
    if (!t || !b || !this.home) return;
    const away = (1 - k) * this.offstage;
    t.pivot.position.set(this.home.top.x, this.home.top.y + away, this.home.top.z);
    b.pivot.position.set(this.home.bottom.x, this.home.bottom.y - away, this.home.bottom.z);
  }

  /* three's viewport counts from the bottom-left; the board counts from the
     top-left, so y is flipped here and nowhere else. */
  render(turn) {
    const { renderer, view } = this;
    this.outfit.rotation.y = turn;
    renderer.clear();
    const y = this.canvas.height - view.y - view.h;
    renderer.setViewport(view.x, y, view.w, view.h);
    renderer.setScissor(view.x, y, view.w, view.h);
    renderer.setScissorTest(true);
    renderer.render(this.scene, this.camera);
    renderer.setScissorTest(false);
    return this.canvas;
  }

  dispose() {
    for (const material of this.materials) material.dispose();
    this.materials.clear();
    this.scene.traverse(node => { if (node.isLight) node.shadow?.dispose(); });
    this.environment.dispose();
    this.renderer.dispose();
    this.parts = {};
  }
}
