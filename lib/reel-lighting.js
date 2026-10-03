import { LIGHT, FABRIC } from './reel-geom.js';

// Shared by the fit preview, video and separate cover.
export const LIGHTING = Object.freeze({
  studio: Object.freeze({ ...LIGHT, exposure: .85, key: 4.5, keyAz: 35, keyEl: 45, fill: 1.8, rim: 2, ambient: .15, envMat: .6 }),
  contrast: Object.freeze({ ...LIGHT, exposure: .8, key: 6, keyAz: 65, keyEl: 50, fill: .6, rim: 4, ambient: .05, envMat: .3 }),
  original: Object.freeze({ ...LIGHT, envMat: FABRIC.envMat }),
});

export function lightingFor(name = 'studio') {
  return Object.hasOwn(LIGHTING, name) ? LIGHTING[name] : LIGHTING.studio;
}
