export const LOGO_SCALE = .75;
const logos = {
  globe: new URL('../assets/album-v2/globe-tenzen.svg', import.meta.url),
  japanese: new URL('../assets/logo.svg', import.meta.url),
  wordmark: new URL('../assets/album-v2/tenzen-wordmark.svg', import.meta.url),
  asterisk: new URL('../assets/album-v2/tenzen-asterisk.svg', import.meta.url),
};
export function artworkRect({ variant = 'japanese', scale = 1, x = .5, y = .5 }) {
  const dimensions = { japanese:[780,328/1000],wordmark:[780,600/3334],asterisk:[260,1],globe:[375,100/527] };
  const [base,ratio] = dimensions[variant] || dimensions.japanese, w=base*LOGO_SCALE*scale,h=w*ratio;
  return {x:x*1080-w/2,y:y*1920-h/2,w,h};
}
export async function loadBrandArtwork() {
  const images = Object.fromEntries(await Promise.all(Object.entries(logos).map(async ([key, url]) => {
    const image = new Image(); image.src = url.href; await image.decode(); return [key, image];
  })));
  const tinted = new OffscreenCanvas(1080, 1080), ctx = tinted.getContext('2d');
  let lastKey = '', w = 0, h = 0;
  return function paintLogo(target, { variant = 'japanese', color = '#ffffff', scale = 1, x: positionX = .5, y: positionY = .5, enabled = true } = {}, y, x) {
    if (!enabled) return;
    const key = `${variant}:${color}`;
    if (key !== lastKey) {
      const image = images[variant] || images.japanese;
      w = (variant === 'globe' ? 375 : variant === 'asterisk' ? 260 : 780) * LOGO_SCALE; h = w * image.naturalHeight / image.naturalWidth;
      ctx.clearRect(0, 0, 1080, 1080); ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(image, 0, 0, w, h);
      ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = color; ctx.fillRect(0, 0, w, h); ctx.globalCompositeOperation = 'source-over'; lastKey = key;
    }
    const width = w * scale, height = h * scale;
    target.drawImage(tinted, 0, 0, w, h, (x ?? positionX * 1080) - width / 2, (y ?? positionY * 1920) - height / 2, width, height);
  };
}

export function paintBecome(target, paintLogo, { x, becomeY, logoY, globeY }) {
  target.save(); target.fillStyle = '#000'; target.textAlign = 'center'; target.textBaseline = 'middle';
  target.font = '400 52px Geist, sans-serif'; target.fillText('Become', x, becomeY);
  paintLogo(target, { variant: 'wordmark', color: '#000000' }, logoY, x);
  paintLogo(target, { variant: 'globe', color: '#000000' }, globeY, x);
  target.restore();
}
