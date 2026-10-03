(async () => {
  const response = await fetch('./docs/story-creator/qa/heic-sample.heic');
  if (!response.ok) throw new Error('HEIC test image could not load.');
  const photo = new File([await response.blob()], 'iPhone.HEIC', { type: '' });
  const transfer = new DataTransfer();
  transfer.items.add(photo);
  const input = document.querySelector('.story-file');
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  for (let i = 0; i < 150; i++) {
    if (document.querySelector('#photoName').textContent === photo.name) break;
    if (document.querySelector('#storyStatus').dataset.error === 'true') throw new Error(document.querySelector('#storyStatus').textContent);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const canvas = document.querySelector('.story-canvas');
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .95));
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (document.querySelector('#photoName').textContent !== photo.name
    || document.querySelector('#download').disabled
    || blob.type !== 'image/webp'
    || String.fromCharCode(...bytes.slice(0, 4)) !== 'RIFF'
    || String.fromCharCode(...bytes.slice(8, 12)) !== 'WEBP') {
    throw new Error('HEIC did not produce a downloadable WebP story.');
  }
  return { heicDecoded: true, webpReady: true, width: canvas.width, height: canvas.height };
})()
