import { LIGHT, FABRIC } from './reel-geom.js';

export const DEFAULT_LIGHTING = 'contrast';

// Shared by the fit preview, video and separate cover.
export const LIGHTING = Object.freeze({
  studio: Object.freeze({ ...LIGHT, exposure: .85, key: 4.5, keyAz: 35, keyEl: 45, fill: 1.8, rim: 2, ambient: .15, envMat: .6 }),
  contrast: Object.freeze({ ...LIGHT, exposure: .8, key: 6, keyAz: 65, keyEl: 50, fill: .6, rim: 4, ambient: .05, envMat: .3 }),
  golden: Object.freeze({ ...LIGHT, exposure: .75, key: 5, keyAz: -50, keyEl: 25, fill: .6, rim: 4, ambient: .05, env: .5, envMat: .15, keyColor: 0xffb876, fillColor: 0xb4ccff, rimColor: 0xff984c }),
  moonlight: Object.freeze({ ...LIGHT, exposure: .65, key: 4.5, keyAz: 45, keyEl: 65, fill: .35, rim: 5, ambient: .03, env: .5, envMat: .1, keyColor: 0x8fb4ff, fillColor: 0x5d79b5, rimColor: 0xc2ddff }),
  tealAmber: Object.freeze({ ...LIGHT, exposure: .75, key: 5, keyAz: -55, keyEl: 35, fill: 1.4, rim: 5, ambient: .03, env: .5, envMat: .1, keyColor: 0xffa76b, fillColor: 0x44d8d8, rimColor: 0x20bdd8 }),
  neon: Object.freeze({ ...LIGHT, exposure: .7, key: 4.5, keyAz: 55, keyEl: 35, fill: 2.5, rim: 5, ambient: .02, env: .5, envMat: .08, keyColor: 0xb389ff, fillColor: 0xff3fa5, rimColor: 0x3cbcff }),
  noir: Object.freeze({ ...LIGHT, exposure: .7, key: 7, keyAz: -80, keyEl: 55, fill: .15, rim: 5, ambient: .02, envMat: .08 }),
  original: Object.freeze({ ...LIGHT, envMat: FABRIC.envMat }),
});

export function lightingFor(name = DEFAULT_LIGHTING) {
  return Object.hasOwn(LIGHTING, name) ? LIGHTING[name] : LIGHTING[DEFAULT_LIGHTING];
}
