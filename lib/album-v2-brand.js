export const LOGO_SCALE = .75;
const logos = {
  globe: new URL('../assets/album-v2/globe-tenzen.svg', import.meta.url),
  japanese: new URL('../assets/logo.svg', import.meta.url),
  wordmark: new URL('../assets/album-v2/tenzen-wordmark.svg', import.meta.url),
  asterisk: new URL('../assets/album-v2/tenzen-asterisk.svg', import.meta.url),
};
export async function loadBrandArtwork() {
  const images = Object.fromEntries(await Promise.all(Object.entries(logos).map(async ([key, url]) => {
    const image = new Image(); image.src = url.href; await image.decode(); return [key, image];
  })));
  const tinted = new OffscreenCanvas(1080, 1080), ctx = tinted.getContext('2d');
  let lastKey = '', w = 0, h = 0;
  return function paintLogo(target, { variant = 'japanese', color = '#ffffff' } = {}, y = 960, x = 540) {
    const key = `${variant}:${color}`;
    if (key !== lastKey) {
      const image = images[variant] || images.japanese;
      w = (variant === 'globe' ? 375 : variant === 'asterisk' ? 260 : 780) * LOGO_SCALE; h = w * image.naturalHeight / image.naturalWidth;
      ctx.clearRect(0, 0, 1080, 1080); ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(image, 0, 0, w, h);
      ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = color; ctx.fillRect(0, 0, w, h); ctx.globalCompositeOperation = 'source-over'; lastKey = key;
    }
    target.drawImage(tinted, 0, 0, w, h, x - w / 2, y - h / 2, w, h);
  };
}

export function paintBecome(target, paintLogo, { x, becomeY, logoY, globeY }) {
  target.save(); target.fillStyle = '#000'; target.textAlign = 'center'; target.textBaseline = 'middle';
  target.font = '700 52px Geist, sans-serif'; target.fillText('Become', x, becomeY);
  paintLogo(target, { variant: 'wordmark', color: '#000000' }, logoY, x);
  paintLogo(target, { variant: 'globe', color: '#000000' }, globeY, x);
  target.restore();
}
