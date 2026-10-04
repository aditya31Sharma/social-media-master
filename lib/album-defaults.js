import { cropToAlpha } from './album-render.js';
const directory = new URL('../assets/album-defaults/', import.meta.url);
let catalogue;
export async function albumDefaults() {
  if (!catalogue) catalogue = fetch(new URL('products.json', directory)).then(response => {
    if (!response.ok) throw new Error('Could not load the five SKU defaults.');
    return response.json();
  }).catch(error => { catalogue = null; throw error; });
  return catalogue;
}
export async function loadAlbumDefault(product) {
  const images = await Promise.allSettled(['model', 'front'].map(async key => {
    const response = await fetch(new URL(product[key], directory));
    if (!response.ok) throw new Error(`Could not load ${product.title}.`);
    return createImageBitmap(await response.blob());
  }));
  if (images.some(result => result.status === 'rejected')) {
    images.forEach(result => { if (result.status === 'fulfilled') result.value.close(); });
    throw images.find(result => result.status === 'rejected').reason;
  }
  const [image, front] = images.map(result => result.value);
  return { image, crop: cropToAlpha(image), front, frontCrop: cropToAlpha(front), productName: product.title, handle: product.handle, glb: product.glb, type: product.type, detailMode: '3d' };
}
