import { loadCatalogue } from '../lib/shopify.js';
import { storyWebP } from './download.js';
import { connectDrive } from './drive-auth.js';

export function setupDrive(getStories) {
  const $ = selector => document.querySelector(selector);
  let products = [], selected = null, drive = null, busy = false, loadingProducts = false;
  const status = (text, error = false) => { $('#driveStatus').textContent = text; $('#driveStatus').dataset.error = String(error); };
  function refresh() {
    $('#driveSave').disabled = busy || !drive || !selected || !getStories().some(story => story.ready);
    $('#driveConnect').disabled = busy;
    $('#driveRefresh').disabled = busy || loadingProducts;
  }
  function filter() {
    const query = $('#driveSearch').value.trim().toLowerCase();
    const matches = products.filter(product => [product.title, product.sku, product.handle].some(value => value?.toLowerCase().includes(query)));
    $('#driveProduct').replaceChildren(new Option('Select a product', ''), ...matches.map(product => new Option(`${product.title}${product.sku ? ` · ${product.sku}` : ''}`, product.id)));
    $('#driveProduct').value = matches.some(product => product.id === selected?.id) ? selected.id : '';
    $('#driveProduct').disabled = !matches.length;
    if (!$('#driveProduct').value) { selected = null; $('#driveFolderLink').hidden = true; }
    refresh();
  }
  async function loadProducts() {
    loadingProducts = true; refresh();
    status('Loading products…');
    try {
      products = await loadCatalogue();
      products.sort((a, b) => a.title.localeCompare(b.title));
      $('#driveSearch').disabled = false;
      filter();
      status(`${products.length} products. Choose a folder before saving.`);
    } catch (error) {
      products = []; selected = null; $('#driveSearch').disabled = true;
      $('#driveFolderLink').hidden = true; filter();
      status(`Products could not load: ${error.message}`, true);
    }
    finally { loadingProducts = false; refresh(); }
  }
  $('#driveSearch').addEventListener('input', filter);
  $('#driveProduct').addEventListener('change', () => {
    selected = products.find(product => product.id === $('#driveProduct').value) || null;
    $('#driveFolderLink').hidden = true;
    refresh();
  });
  $('#driveRefresh').addEventListener('click', loadProducts);
  $('#driveConnect').addEventListener('click', async () => {
    busy = true; refresh(); status('Connecting to Google Drive…');
    try {
      drive = await connectDrive();
      $('#driveConnect').textContent = 'Reconnect Google Drive';
      status('Connected to team@tenzen.in.');
    } catch (error) { drive = null; status(error.message, true); }
    finally { busy = false; refresh(); }
  });
  $('#driveSave').addEventListener('click', async () => {
    if (busy || !drive || !selected) return;
    const ready = getStories().filter(story => story.ready);
    if (!ready.length) return;
    busy = true; refresh(); $('#driveFolderLink').hidden = true;
    let saved = 0;
    try {
      status(`Preparing ${ready.length} WebPs…`);
      const files = await Promise.all(ready.map(storyWebP));
      const folder = await drive.productFolder(selected);
      $('#driveFolderLink').href = `https://drive.google.com/drive/u/0/folders/${encodeURIComponent(folder)}`;
      $('#driveFolderLink').hidden = false;
      for (const file of files) {
        await drive.upload(folder, file, selected);
        saved++; status(`Saved ${saved} of ${files.length} to ${selected.title}.`);
      }
      const skipped = getStories().length - ready.length;
      status(`Saved ${saved} WebPs to ${selected.title}.${skipped ? ` ${skipped} unfinished ${skipped === 1 ? 'story' : 'stories'} skipped.` : ''}`);
    } catch (error) {
      if (/auth|token|credential|unauthoriz/i.test(error.message)) {
        drive = null; $('#driveConnect').textContent = 'Connect Google Drive';
      }
      status(`${saved} saved. ${error.message}`, true);
    } finally { busy = false; refresh(); }
  });
  loadProducts();
  return { refresh };
}
