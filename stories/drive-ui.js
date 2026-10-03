import { loadCatalogue } from '../lib/shopify.js';
import { storyWebP } from './download.js';
import { connectDrive } from './drive-auth.js';
import { DRIVE_ACCOUNT } from './drive-api.js';

export function setupDrive(getStories, onSavedUsers, root = document) {
  const $ = selector => root.querySelector(selector);
  let products = [], selected = null, drive = null, busy = false, loadingProducts = false, scanVersion = 0;
  let savedUsers = null, savedFileCount = 0;
  let productsRequest = 0;
  const status = (text, error = false) => { $('#driveStatus').textContent = text; $('#driveStatus').dataset.error = String(error); };
  function connection(state, note) {
    $('#driveConnection').dataset.state = state;
    $('#driveConnectionStatus').textContent = state === 'connected' ? `Connected · ${DRIVE_ACCOUNT}`
      : state === 'connecting' ? 'Connecting…' : state === 'error' ? 'Connection failed' : 'Not connected';
    $('#driveConnectionNote').textContent = note;
    $('#driveConnect').textContent = state === 'connected' ? 'Reconnect Google Drive' : 'Connect Google Drive';
    $('#driveConnect').classList.toggle('btn--primary', state !== 'connected');
  }
  function resetSavedUsers() { scanVersion++; savedUsers = null; onSavedUsers(null); }
  function globalSummary() {
    $('#driveConnectionNote').textContent = `${savedFileCount} saved WebPs across Tenzen Reviews. ${savedUsers.size} users excluded from Randomize across all products.`;
  }
  async function scanSavedUsers() {
    const version = ++scanVersion;
    savedUsers = null; onSavedUsers(null);
    $('#driveConnectionNote').textContent = 'Checking saved stories across all product folders…';
    try {
      const result = await drive.savedUsernames();
      if (version !== scanVersion) return;
      savedUsers = result.usernames;
      savedFileCount = result.fileCount;
      onSavedUsers(new Set(savedUsers));
      globalSummary();
    } catch (error) {
      if (version !== scanVersion) return;
      $('#driveConnectionNote').textContent = `Could not check all saved stories: ${error.message}. Reconnect Google Drive to retry.`;
    }
  }
  async function showProductFolder() {
    const product = selected, client = drive;
    if (!product || !client) return;
    try {
      const folderId = await client.productFolder(product, false);
      if (selected?.id !== product.id || drive !== client || !folderId) return;
      $('#driveFolderLink').href = `https://drive.google.com/drive/u/0/folders/${encodeURIComponent(folderId)}`;
      $('#driveFolderLink').hidden = false;
    } catch (error) {
      if (selected?.id === product.id && drive === client) status(`Could not open product folder: ${error.message}`, true);
    }
  }
  function refresh() {
    $('#driveSave').disabled = busy || !drive || !selected || !savedUsers || !getStories().some(story => story.ready);
    $('#driveConnect').disabled = busy;
    $('#driveRefresh').disabled = busy || loadingProducts;
    $('#driveSearch').disabled = busy || !products.length;
    $('#driveProduct').disabled = busy || !$('#driveProduct').options.length || $('#driveProduct').options.length === 1;
  }
  function filter() {
    const query = $('#driveSearch').value.trim().toLowerCase();
    const matches = products.filter(product => [product.title, product.sku, product.handle].some(value => value?.toLowerCase().includes(query)));
    $('#driveProduct').replaceChildren(new Option('Select a product', ''), ...matches.map(product => new Option(`${product.title}${product.sku ? ` · ${product.sku}` : ''}`, product.id)));
    $('#driveProduct').value = matches.some(product => product.id === selected?.id) ? selected.id : '';
    $('#driveProduct').disabled = !matches.length;
    if (!$('#driveProduct').value) {
      selected = null; $('#driveFolderLink').hidden = true;
      status('Select a product folder before saving.');
    }
    refresh();
  }
  async function loadProducts() {
    const request = ++productsRequest;
    loadingProducts = true; refresh();
    status('Loading products…');
    const timer = setTimeout(() => {
      if (request !== productsRequest) return;
      loadingProducts = false; refresh();
      status('Still connecting. Check your internet, or refresh products.');
    }, 6000);
    try {
      const loaded = await loadCatalogue();
      if (request !== productsRequest) return;
      clearTimeout(timer);
      products = loaded;
      products.sort((a, b) => a.title.localeCompare(b.title));
      $('#driveSearch').disabled = false;
      filter();
      status(selected ? `Stories will save to ${selected.title}.` : `${products.length} products. Choose a folder before saving.`);
    } catch (error) {
      if (request !== productsRequest) return;
      products = []; selected = null; $('#driveSearch').disabled = true;
      $('#driveFolderLink').hidden = true; filter();
      status(`Products could not load: ${error.message}`, true);
    }
    finally { clearTimeout(timer); if (request === productsRequest) { loadingProducts = false; refresh(); } }
  }
  $('#driveSearch').addEventListener('input', filter);
  $('#driveProduct').addEventListener('change', () => {
    selected = products.find(product => product.id === $('#driveProduct').value) || null;
    $('#driveFolderLink').hidden = true;
    status(selected ? `Stories will save to ${selected.title}.` : 'Select a product folder before saving.');
    showProductFolder(); refresh();
  });
  $('#driveRefresh').addEventListener('click', loadProducts);
  $('#driveConnect').addEventListener('click', async () => {
    busy = true; resetSavedUsers(); refresh(); status('Connecting to Google Drive…');
    connection('connecting', `Choose ${DRIVE_ACCOUNT} in the Google account picker.`);
    try {
      drive = await connectDrive();
      connection('connected', 'Checking saved users across Tenzen Reviews.');
      await scanSavedUsers();
      showProductFolder();
      status(selected ? `Stories will save to ${selected.title}.` : 'Choose a product folder before saving.');
    } catch (error) {
      drive = null; resetSavedUsers(); status(error.message, true);
      connection('error', error.message);
    }
    finally { busy = false; refresh(); }
  });
  $('#driveSave').addEventListener('click', async () => {
    if (busy || !drive || !selected || !savedUsers) return;
    const ready = getStories().filter(story => story.ready);
    if (!ready.length) return;
    busy = true; refresh(); $('#driveFolderLink').hidden = true;
    let saved = 0;
    try {
      status(`Preparing ${ready.length} WebPs…`);
      const files = await Promise.all(ready.map(async story => ({ ...await storyWebP(story), username: story.username })));
      const folder = await drive.productFolder(selected);
      $('#driveFolderLink').href = `https://drive.google.com/drive/u/0/folders/${encodeURIComponent(folder)}`;
      $('#driveFolderLink').hidden = false;
      for (const file of files) {
        await drive.upload(folder, file, selected);
        savedUsers.add(file.username.toLowerCase());
        savedFileCount++;
        globalSummary();
        onSavedUsers(new Set(savedUsers));
        saved++; status(`Saved ${saved} of ${files.length} to ${selected.title}.`);
      }
      const skipped = getStories().length - ready.length;
      status(`Saved ${saved} WebPs to ${selected.title}.${skipped ? ` ${skipped} unfinished ${skipped === 1 ? 'story' : 'stories'} skipped.` : ''}`);
    } catch (error) {
      if (/auth|token|credential|unauthoriz/i.test(error.message)) {
        drive = null;
        connection('error', 'Reconnect Google Drive to continue saving.');
        resetSavedUsers();
      }
      status(`${saved} saved. ${error.message}`, true);
    } finally { busy = false; refresh(); }
  });
  loadProducts();
  return { refresh };
}
