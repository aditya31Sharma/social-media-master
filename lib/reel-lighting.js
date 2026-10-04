import { LIGHT, FABRIC } from './reel-geom.js';

export const DEFAULT_LIGHTING = 'contrast';

// Shared by the fit preview, video and separate cover.
export const LIGHTING = Object.freeze({
  studio: Object.freeze({ ...LIGHT, exposure: .85, key: 4.5, keyAz: 35, keyEl: 45, fill: 1.8, rim: 2, ambient: .15, envMat: .6 }),
  contrast: Object.freeze({ ...LIGHT, exposure: .8, key: 6, keyAz: 65, keyEl: 50, fill: .6, rim: 4, ambient: .05, envMat: .3 }),
  side: Object.freeze({ ...LIGHT, exposure: .8, key: 7, keyAz: 85, keyEl: 20, fill: .35, fillAz: -30, fillEl: 20, rim: 3, rimAz: -140, rimEl: 30, ambient: .03, envMat: .3 }),
  overhead: Object.freeze({ ...LIGHT, exposure: .8, key: 7, keyAz: 0, keyEl: 82, fill: .65, fillAz: 0, fillEl: 10, rim: 3, rimAz: 165, rimEl: 25, ambient: .04, envMat: .3 }),
  backlit: Object.freeze({ ...LIGHT, exposure: .8, key: 1.8, keyAz: 35, keyEl: 30, fill: .8, fillAz: -45, fillEl: 15, rim: 10, rimAz: 180, rimEl: 35, ambient: .04, envMat: .3 }),
  cross: Object.freeze({ ...LIGHT, exposure: .8, key: 5, keyAz: -60, keyEl: 30, fill: 3.5, fillAz: 60, fillEl: 30, rim: 1.8, rimAz: 180, rimEl: 60, ambient: .04, envMat: .3 }),
  lowkey: Object.freeze({ ...LIGHT, exposure: .8, key: 5.5, keyAz: -75, keyEl: 45, fill: .15, fillAz: 35, fillEl: 20, rim: 6, rimAz: 135, rimEl: 15, ambient: .02, envMat: .3 }),
  original: Object.freeze({ ...LIGHT, envMat: FABRIC.envMat }),
});

export function lightingFor(name = DEFAULT_LIGHTING) {
  return Object.hasOwn(LIGHTING, name) ? LIGHTING[name] : LIGHTING[DEFAULT_LIGHTING];
}

// One world unit is a centimetre. Existing rigs retain their exact positions;
// new rigs give each light its own azimuth and elevation around the outfit.
export function lightPosition(light, role) {
  const d = 300, keyAz = light.keyAz * Math.PI / 180;
  if (role === 'fill' && light.fillAz === undefined) {
    return [-Math.sin(keyAz) * d * .7, 40, Math.cos(keyAz) * d * .7 + 120];
  }
  if (role === 'rim' && light.rimAz === undefined) {
    return [Math.sin(keyAz + Math.PI) * d, 90, -d * .8];
  }
  const az = light[`${role}Az`] * Math.PI / 180;
  const el = light[`${role}El`] * Math.PI / 180;
  return [Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d];
}
