/* The two garments, in three dimensions.

   Each one is a GLB off the Shopify CDN, rendered with an ORTHOGRAPHIC camera.
   Orthographic matters: a perspective camera makes a turning garment breathe,
   growing as a shoulder swings toward the lens, and the board's two boxes are
   fixed. Orthographic keeps the silhouette the size it was measured at.

   Both models share one renderer and one turn. Frame n of the clip is the same
   angle for both, which is what makes the hoodie and the trousers read as one
   body turning rather than two objects spinning near each other. */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const DRACO_PATH = 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/';

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
  const p = gltfLoader().loadAsync(url).then(gltf => gltf.scene);
  cache.set(url, p);
  return p;
}

/* The model is fitted by the size it is FACING FRONT, because that is the view
   the board was drawn from and the brief is to match the board. Fitting by the
   cylinder it sweeps instead - the safe option - renders the garment visibly
   smaller than the flat art it replaces: a hoodie loses 9% and trousers 18%,
   which is the difference between matching the design and not.

   Turning past the corner does make the silhouette wider than the front view,
   so the VIEWPORT is padded by exactly that ratio. The garment can swell into
   the padding instead of being clipped, and its size at the front is still the
   size the board specifies. */
function measure(object) {
  const box = new THREE.Box3().setFromObject(object);
  const centre = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  return {
    centre, size,
    /* Widest projection through a full turn, over the front width. */
    swell: Math.hypot(size.x, size.z) / size.x,
  };
}

export class Stage {
  constructor(width, height) {
    this.canvas = new OffscreenCanvas(width, height);
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, antialias: true, alpha: true, preserveDrawingBuffer: false,
    });
    this.renderer.setSize(width, height, false);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.autoClear = false;
    this.parts = [];
  }

  /* `box` is the garment's rectangle on the board, already in render pixels.
     `fill` is how much of it the garment occupies, which is the one number
     that gets matched against the Figma by eye. */
  add(object, box, fill, offsetY = 0) {
    const pivot = new THREE.Object3D();
    const { centre, size, swell } = measure(object);
    /* Re-centred on its own middle so the turn is about the garment's axis and
       not about wherever the exporter happened to put the origin. */
    object.position.set(-centre.x, -centre.y, -centre.z);
    pivot.add(object);

    const scene = new THREE.Scene();
    scene.add(pivot);
    /* Flat, even light. This is a product shot on white, not a lit set: a hard
       key would put a shadow down one side that the flat photographs beside it
       do not have. */
    scene.add(new THREE.AmbientLight(0xffffff, 2.4));
    const fillLight = new THREE.DirectionalLight(0xffffff, 1.5);
    fillLight.position.set(0.4, 1, 2);
    scene.add(fillLight);
    const rim = new THREE.DirectionalLight(0xffffff, 0.7);
    rim.position.set(-1, 0.5, -1.5);
    scene.add(rim);

    /* Pixels per world unit: fit on whichever axis runs out first - a hoodie
       is bound by its width, trousers by their height - then apply fill. */
    const ppu = Math.min(box.w / size.x, box.h / size.y) * fill;

    /* The viewport is the box widened by the swell, about the same centre, so
       a garment three-quarters through its turn has somewhere to go. Height is
       untouched: turning about the vertical axis cannot make it taller. */
    const padX = Math.ceil(box.w * (swell - 1) / 2) + 2;
    const view = { x: box.x - padX, y: box.y + offsetY, w: box.w + padX * 2, h: box.h };

    const camera = new THREE.OrthographicCamera(
      -view.w / 2 / ppu, view.w / 2 / ppu,
       view.h / 2 / ppu, -view.h / 2 / ppu,
      0.01, Math.max(size.x, size.y, size.z) * 40 + 100);
    camera.position.set(0, 0, Math.max(size.x, size.y, size.z) * 8 + 10);
    camera.lookAt(0, 0, 0);

    this.parts.push({ pivot, scene, camera, box: view });
    return this;
  }

  /* three's viewport counts from the bottom-left; the board counts from the
     top-left, so y is flipped here and nowhere else. */
  render(turn) {
    const { renderer } = this;
    renderer.clear();
    for (const p of this.parts) {
      p.pivot.rotation.y = turn;
      const y = this.canvas.height - p.box.y - p.box.h;
      renderer.setViewport(p.box.x, y, p.box.w, p.box.h);
      renderer.setScissor(p.box.x, y, p.box.w, p.box.h);
      renderer.setScissorTest(true);
      renderer.render(p.scene, p.camera);
    }
    renderer.setScissorTest(false);
    return this.canvas;
  }

  dispose() {
    this.renderer.dispose();
    this.parts = [];
  }
}
