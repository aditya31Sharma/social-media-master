export function normalizeUsername(value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase();
}

export function savedUsername(file) {
  const name = file?.name || '';
  if (file?.mimeType !== 'image/webp' && !/\.webp$/i.test(name)) return null;
  const tagged = normalizeUsername(file.properties?.instagramUsername);
  if (tagged) return tagged;
  const match = /^story-\d+-(.+)-\d{1,2}[mh]\.webp$/i.exec(name);
  return match ? normalizeUsername(match[1]) : null;
}
