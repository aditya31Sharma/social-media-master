/* The 3D lab. Local only, never deployed.

   Two jobs: get the two garments into proportion with each other, and light
   them so they read as photographed rather than as geometry. Both are done by
   eye here and the numbers are then copied into the reel. */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadModel } from '../lib/stage3d.js';
import { loadCatalogue, loadModelIndex } from '../lib/shopify.js';
import { lengthOf, OVERLAP_CM } from '../lib/garment-scale.js';

const $ = s => document.querySelector(s);
const cv = $('#cv');

/* The board's own proportions, so what is judged here is what ships. */
const BOARD_W = 3000, BOARD_H = 5333;
const W = 620, H = Math.round(BOARD_W ? W_H() : 0);
function W_H() { return BOARD_H * (620 / BOARD_W); }

cv.width = W; cv.height = Math.round(W_H());

const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.setSize(cv.width, cv.height, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envTex;

/* One orthographic camera over the whole outfit: both garments live in the
   same world at their real relative sizes, which is the entire point. */
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -500, 500);

const ambient = new THREE.AmbientLight(0xffffff, 0.35);
const key = new THREE.DirectionalLight(0xffffff, 3);
const fill = new THREE.DirectionalLight(0xffffff, 0.8);
const rim = new THREE.DirectionalLight(0xffffff, 2.2);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.bias = -0.0012;
key.shadow.normalBias = 0.02;
scene.add(ambient, key, fill, rim, key.target, fill.target, rim.target);

const outfit = new THREE.Group();          // turns as one
scene.add(outfit);

const S = {
  top: 'narcissistic-tendency-oversized-hoodie-black',
  bot: 'angels-motor-club-loose-fit-sweatpant-black',
  topCm: 72, botCm: 104, overlap: OVERLAP_CM, fitCm: 190, nudge: 0,
  exp: 1.15, env: 1.0, key: 3.0, keyAz: -32, keyEl: 34, fill: 0.7, rim: 2.4, amb: 0.35,
  shadow: true, tone: 'aces', turn: 0,
  rough: -0.05, sheen: 0.7, envMat: 1.1,
};

let models = {}, catalogue = [], parts = { top: null, bot: null };

const TONES = {
  aces: THREE.ACESFilmicToneMapping, neutral: THREE.NeutralToneMapping,
  reinhard: THREE.ReinhardToneMapping, none: THREE.NoToneMapping,
};

/* Everything in centimetres: one world unit is one centimetre, so the two
   garments are directly comparable and the camera is framed in cm too. */
function place() {
  for (const which of ['top', 'bot']) {
    const p = parts[which];
    if (!p) continue;
    const wantCm = which === 'top' ? S.topCm : S.botCm;
    const k = wantCm / p.nativeH;
    p.pivot.scale.setScalar(k);
  }
  const t = parts.top, b = parts.bot;
  if (!t || !b) return;

  const topH = S.topCm, botH = S.botCm;
  /* The waistband sits `overlap` above the top's hem, so the trousers go
     behind the top rather than under it. */
  const totalH = topH + botH - S.overlap;
  /* Hang the outfit about its own middle. */
  const topY = totalH / 2 - topH / 2;
  const botY = totalH / 2 - topH + S.overlap - botH / 2;
  t.pivot.position.set(0, topY + S.nudge, 0.1);
  b.pivot.position.set(0, botY + S.nudge, -0.1);

  const halfH = S.fitCm / 2;
  const halfW = halfH * (cv.width / cv.height);
  camera.left = -halfW; camera.right = halfW;
  camera.top = halfH; camera.bottom = -halfH;
  camera.position.set(0, 0, 400);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();

  const d = 300;
  const az = S.keyAz * Math.PI / 180, el = S.keyEl * Math.PI / 180;
  key.position.set(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d);
  fill.position.set(-Math.sin(az) * d * 0.7, 40, Math.cos(az) * d * 0.7 + 120);
  rim.position.set(Math.sin(az + Math.PI) * d, 90, -d * 0.8);

  const s = key.shadow.camera;
  s.left = -halfW * 1.4; s.right = halfW * 1.4;
  s.top = halfH * 1.4; s.bottom = -halfH * 1.4;
  s.near = 1; s.far = d * 3;
  s.updateProjectionMatrix();
}

/* Cloth in these exports is authored nearly matte, so the key light has
   nothing to catch and the garment reads as a flat silhouette. Taking the
   roughness down a little and adding sheen - which is the physically right
   term for fabric, not a metal highlight - is what makes the folds show. */
function applyFabric() {
  for (const which of ['top', 'bot']) {
    for (const m of parts[which]?.mats || []) {
      m.roughness = Math.min(1, Math.max(0.05, (m.userData.baseRoughness ?? 1) + S.rough));
      m.envMapIntensity = S.envMat;
      if ('sheen' in m) {
        m.sheen = S.sheen;
        /* Broad and soft. A tight sheen lobe reads as satin; fleece scatters. */
        m.sheenRoughness = 0.85;
        if (m.sheenColor) m.sheenColor.setRGB(1, 1, 1);
      }
      m.needsUpdate = true;
    }
  }
}

function applyLights() {
  renderer.toneMapping = TONES[S.tone];
  renderer.toneMappingExposure = S.exp;
  scene.environmentIntensity = S.env;
  ambient.intensity = S.amb;
  key.intensity = S.key;
  fill.intensity = S.fill;
  rim.intensity = S.rim;
  key.castShadow = S.shadow;
  renderer.shadowMap.enabled = S.shadow;
}

async function mount(which, handle) {
  const url = models[handle];
  if (!url) return;
  if (parts[which]) outfit.remove(parts[which].pivot);
  const src = await loadModel(url);
  const obj = src.clone(true);
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  obj.position.set(-centre.x, -centre.y, -centre.z);
  const mats = [];
  obj.traverse(n => {
    if (!n.isMesh) return;
    n.castShadow = true; n.receiveShadow = true;
    for (const m of (Array.isArray(n.material) ? n.material : [n.material])) {
      if (!m || mats.includes(m)) continue;
      /* Kept so the sliders adjust FROM the asset's own value rather than
         overwriting it - a fabric authored at 0.95 and one at 0.6 should not
         end up identical. */
      m.userData.baseRoughness = m.roughness ?? 1;
      mats.push(m);
    }
  });
  const pivot = new THREE.Object3D();
  pivot.add(obj);
  outfit.add(pivot);
  parts[which] = { pivot, nativeH: size.y, nativeW: size.x, handle, mats };
  window.__mounted = (window.__mounted || 0) + 1;
  const type = catalogue.find(p => p.handle === handle)?.type || '';
  if (which === 'top') { S.topCm = lengthOf(type); $('#topCm').value = S.topCm; }
  else { S.botCm = lengthOf(type); $('#botCm').value = S.botCm; }
  syncOutputs();
  place();
}

function draw() {
  outfit.rotation.y = S.turn * Math.PI / 180;
  applyLights();
  applyFabric();
  renderer.render(scene, camera);
}

let spinning = false;
function loop() {
  if (spinning) { S.turn = (S.turn + 0.8) % 360; $('#turn').value = S.turn; $('#turnO').textContent = Math.round(S.turn) + '°'; }
  draw();
  requestAnimationFrame(loop);
}

const FIELDS = ['topCm','botCm','overlap','fitCm','nudge','exp','env','key','keyAz','keyEl','fill','rim','amb','turn','rough','sheen','envMat'];
const UNITS = { topCm:'cm', botCm:'cm', overlap:'cm', fitCm:'cm', nudge:'cm', keyAz:'°', keyEl:'°', turn:'°' };

function syncOutputs() {
  for (const f of FIELDS) {
    const el = $('#' + f); if (!el) continue;
    el.value = S[f];
    const o = $('#' + f + 'O');
    if (o) o.textContent = `${Math.round(S[f] * 100) / 100}${UNITS[f] || ''}`;
  }
  $('#out').textContent = JSON.stringify({
    proportion: { topCm: S.topCm, botCm: S.botCm, overlap: S.overlap, fitCm: S.fitCm, nudge: S.nudge },
    light: { exposure: S.exp, env: S.env, key: S.key, keyAz: S.keyAz, keyEl: S.keyEl,
             fill: S.fill, rim: S.rim, ambient: S.amb, shadows: S.shadow, tone: S.tone },
    fabric: { roughness: S.rough, sheen: S.sheen, envMat: S.envMat },
  }, null, 1);
}

for (const f of FIELDS) {
  const el = $('#' + f); if (!el) continue;
  el.addEventListener('input', () => { S[f] = +el.value; syncOutputs(); place(); });
}
$('#shadow').addEventListener('change', e => { S.shadow = e.target.checked; syncOutputs(); });
$('#tone').addEventListener('change', e => { S.tone = e.target.value; syncOutputs(); });
$('#spin').addEventListener('click', () => { spinning = !spinning; $('#spin').textContent = spinning ? 'Stop' : 'Spin'; });
$('#copy').addEventListener('click', () => navigator.clipboard.writeText($('#out').textContent));
$('#reset').addEventListener('click', () => location.reload());

/* Four angles at once, which is the only way to see whether a light works
   through the whole turn rather than just facing front. */
$('#grid').addEventListener('click', () => {
  const was = S.turn, shots = [];
  for (const a of [0, 90, 180, 270]) { S.turn = a; draw(); shots.push(cv.toDataURL('image/png')); }
  S.turn = was; draw();
  const w = window.open('', '_blank');
  w.document.write('<body style="margin:0;background:#222;display:flex">' +
    shots.map(s => `<img src="${s}" style="width:25%">`).join('') + '</body>');
});

(async () => {
  [catalogue, models] = await Promise.all([loadCatalogue(), loadModelIndex()]);
  const wearable = catalogue.filter(p => models[p.handle]);
  for (const [sel, cur] of [['#top', S.top], ['#bot', S.bot]]) {
    const node = $(sel);
    for (const p of wearable) {
      const o = document.createElement('option');
      o.value = p.handle; o.textContent = `${p.title}  ·  ${p.type}`;
      if (p.handle === cur) o.selected = true;
      node.appendChild(o);
    }
    node.addEventListener('change', () => mount(sel === '#top' ? 'top' : 'bot', node.value));
  }
  await mount('top', S.top);
  await mount('bot', S.bot);
  syncOutputs();
  place();
  loop();
  window.__ready = true;
})();
