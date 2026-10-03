import { savedUsername } from './saved-users.js';

const API = 'https://www.googleapis.com/drive/v3';
const FOLDER = 'application/vnd.google-apps.folder';
export const ROOT_NAME = 'Tenzen Reviews';
export const DRIVE_ACCOUNT = 'team@tenzen.in';

function queryValue(value) { return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

export function createDriveApi(token, send = fetch) {
  async function request(path, options = {}) {
    const response = await send(path, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, ...options.headers },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error?.message || `Google Drive returned ${response.status}.`);
    }
    return response.json();
  }

  async function account() {
    const about = await request(`${API}/about?fields=user(emailAddress)`);
    const email = about.user?.emailAddress?.toLowerCase();
    if (email !== DRIVE_ACCOUNT) throw new Error(`Choose ${DRIVE_ACCOUNT} in the Google account picker.`);
    return email;
  }

  async function folders(parent, name) {
    const q = [`'${queryValue(parent)}' in parents`, `mimeType = '${FOLDER}'`, 'trashed = false'];
    if (name) q.push(`name = '${queryValue(name)}'`);
    let pageToken = '', found = [];
    do {
      const params = new URLSearchParams({ q: q.join(' and '), fields: 'nextPageToken,files(id,name,properties)', pageSize: '1000' });
      if (pageToken) params.set('pageToken', pageToken);
      const page = await request(`${API}/files?${params}`);
      found = found.concat(page.files || []); pageToken = page.nextPageToken || '';
    } while (pageToken);
    return found;
  }

  async function createFolder(name, parent, productId) {
    return request(`${API}/files?fields=id,name`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: FOLDER, parents: [parent], ...(productId ? { properties: { shopifyProductId: productId } } : {}) }),
    });
  }

  async function productFolder(product, create = true) {
    const roots = await folders('root', ROOT_NAME);
    if (!roots.length && !create) return null;
    const root = roots[0] || await createFolder(ROOT_NAME, 'root');
    const children = await folders(root.id);
    const match = children.find(folder => folder.properties?.shopifyProductId === product.id);
    if (match) {
      if (create && match.name !== product.title) await request(`${API}/files/${encodeURIComponent(match.id)}?fields=id,name`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: product.title }),
      });
      return match.id;
    }
    if (!create) return null;
    return (await createFolder(product.title, root.id, product.id)).id;
  }

  async function savedUsernames() {
    const pending = (await folders('root', ROOT_NAME)).map(folder => folder.id);
    const visited = new Set(), usernames = new Set();
    let fileCount = 0;
    for (let index = 0; index < pending.length; index++) {
      const folderId = pending[index];
      if (visited.has(folderId)) continue;
      visited.add(folderId);
      let pageToken = '';
      do {
        const params = new URLSearchParams({
          q: `'${queryValue(folderId)}' in parents and trashed = false`,
          fields: 'nextPageToken,files(id,name,mimeType,properties)', pageSize: '1000',
        });
        if (pageToken) params.set('pageToken', pageToken);
        const page = await request(`${API}/files?${params}`);
        for (const file of page.files || []) {
          if (file.mimeType === FOLDER) { pending.push(file.id); continue; }
          if (file.mimeType !== 'image/webp' && !/\.webp$/i.test(file.name || '')) continue;
          fileCount++;
          const username = savedUsername(file);
          if (username) usernames.add(username);
        }
        pageToken = page.nextPageToken || '';
      } while (pageToken);
    }
    return { fileCount, usernames };
  }

  async function upload(folderId, file, product) {
    const boundary = `story-${crypto.randomUUID()}`;
    const metadata = { name: file.name, mimeType: 'image/webp', parents: [folderId],
      properties: { shopifyProductId: product.id, sku: product.sku || '',
        ...(file.username ? { instagramUsername: file.username } : {}) } };
    const payload = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
      `--${boundary}\r\nContent-Type: image/webp\r\n\r\n`, file.blob, `\r\n--${boundary}--\r\n`,
    ], { type: `multipart/related; boundary=${boundary}` });
    return request('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
      method: 'POST', headers: { 'Content-Type': payload.type }, body: payload,
    });
  }

  return { account, productFolder, savedUsernames, upload };
}
