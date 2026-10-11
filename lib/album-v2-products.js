import { readProduct, pickImage, sized } from './shopify.js';
import { loadShoot } from './album-v2-media.js';
import { cutoutPerson } from './album-v2-lineup.js';

export function productDescriptor(product) {
  if (!product.glb) throw new Error(`No 3D garment is available for ${product.title}.`);
  const used = new Set();
  const wants = ['Shoot-1', 'Macro-Front', 'Model-Man-Front', 'Model-Woman-Front'];
  const labels = ['Shoot', 'Macro', 'Man front full', 'Woman front full'];
  const photos = wants.map((want, i) => {
    const full = product.byName[`${want}-Full`];
    const image = full ? { name: `${want}-Full`, ...full } : pickImage(product.byName, want, used);
    if (!image) throw new Error(`Could not load ${product.title}: ${labels[i]}.`);
    used.add(image.name);
    return { label: labels[i], file: image.url, source: image.url };
  });
  return { ...product, photos, detailMode: '3d' };
}

export function disposeProduct(asset) {
  const images = new Set([...(asset?.photos || []).map(photo => photo.image), ...Object.values(asset?.people || {}).map(person => person.image)]);
  images.forEach(image => image?.close?.());
  if (asset?.glb?.startsWith('blob:')) URL.revokeObjectURL(asset.glb);
}

export async function loadReplacement(handle, dependencies = {}) {
  const read = dependencies.readProduct || readProduct;
  const shoot = dependencies.loadShoot || loadShoot;
  const cutout = dependencies.cutoutPerson || cutoutPerson;
  const preload = dependencies.loadModel || (async url => (await import('./stage3d.js')).loadModel(url));
  const descriptor = productDescriptor(await read(handle));
  // Fetch and parse this product's GLB before committing a replacement.
  await preload(descriptor.glb);
  const preview = { ...descriptor, photos: descriptor.photos.map(photo => ({ ...photo, file: sized(photo.file, 1280) })) };
  const asset = await shoot(preview, { preview: true });
  asset.photos.forEach((photo, index) => { photo.file = descriptor.photos[index].file; });
  asset.people = {};
  try {
    for (const [gender, index] of [['man', 2], ['woman', 3]]) asset.people[gender] = await cutout(asset.photos[index].image);
    return asset;
  } catch (error) { disposeProduct(asset); throw error; }
}
