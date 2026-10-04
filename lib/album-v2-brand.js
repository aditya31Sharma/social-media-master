const logos = {
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
  return function paintLogo(target, { variant = 'japanese', color = '#ffffff' } = {}, y = 960) {
    const key = `${variant}:${color}`;
    if (key !== lastKey) {
      const image = images[variant] || images.japanese;
      w = variant === 'asterisk' ? 260 : 780; h = w * image.naturalHeight / image.naturalWidth;
      ctx.clearRect(0, 0, 1080, 1080); ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(image, 0, 0, w, h);
      ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = color; ctx.fillRect(0, 0, w, h); ctx.globalCompositeOperation = 'source-over'; lastKey = key;
    }
    target.drawImage(tinted, 0, 0, w, h, (1080 - w) / 2, y - h / 2, w, h);
  };
}
