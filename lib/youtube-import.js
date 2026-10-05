export function youtubeVideoURL(value) {
  let url;
  try { url = new URL(value.trim()); } catch { throw Error('Paste a valid YouTube video link.'); }
  const parts = url.pathname.split('/').filter(Boolean);
  const hosts = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'];
  let id = '';
  if (['youtu.be', 'www.youtu.be'].includes(url.hostname) && parts.length === 1) id = parts[0];
  if (hosts.includes(url.hostname)) id = url.pathname === '/watch' ? url.searchParams.get('v') : parts.length === 2 && ['shorts','live','embed'].includes(parts[0]) ? parts[1] : '';
  if (!['https:','http:'].includes(url.protocol) || url.username || url.password || url.port || !/^[\w-]{11}$/.test(id || '')) throw Error('Paste a YouTube video link, not a channel or playlist.');
  return `https://www.youtube.com/watch?v=${id}`;
}
export function wireYouTubeImport(host, { load, busy = () => false }) {
  const panel = document.createElement('div'); panel.className = 'youtube-import';
  panel.innerHTML = `<label class="field"><span>YouTube link</span><input class="input" type="url" placeholder="https://youtube.com/watch?v=…" autocomplete="off" spellcheck="false" aria-label="YouTube video link"></label><div class="youtube-import__actions"><button class="btn" type="button" data-youtube-import>Import audio</button><button class="btn" type="button" data-youtube-cancel hidden>Cancel</button><a class="btn" data-youtube-download hidden>Download MP3</a></div><p class="note" role="status" data-youtube-status></p>`;
  host.append(panel);
  const $ = selector => panel.querySelector(selector), input = $('input'), button = $('[data-youtube-import]'), cancel = $('[data-youtube-cancel]'), download = $('[data-youtube-download]'), status = $('[data-youtube-status]');
  let request = null, downloadURL = null;
  cancel.addEventListener('click', () => request?.abort());
  input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); button.click(); } });
  button.addEventListener('click', async () => {
    if (request || busy()) return;
    try {
      const url = youtubeVideoURL(input.value);
      request = new AbortController(); button.disabled = true; input.disabled = true; cancel.hidden = false;
      status.textContent = 'Getting audio from YouTube…';
      const timeout = setTimeout(() => request?.abort(), 160000);
      let response, blob;
      try {
        response = await fetch(new URL('../api/youtube-audio', import.meta.url), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }), signal: request.signal });
        if (!response.ok) {
          if (response.status === 404 || response.status === 501) throw Error('YouTube import needs the audio service. Open the local audio editor on port 8091.');
          const result = await response.json(); throw Error(result.error || 'Audio import failed.');
        }
        if (!response.headers.get('Content-Type')?.startsWith('audio/mpeg')) throw Error('The audio service did not return an MP3.');
        blob = await response.blob();
      } finally { clearTimeout(timeout); }
      if (request.signal.aborted) throw new DOMException('Import cancelled.', 'AbortError');
      const encoded = response.headers.get('Content-Disposition')?.match(/filename\*=UTF-8''(.+)/i)?.[1];
      const name = encoded ? decodeURIComponent(encoded) : 'YouTube audio.mp3';
      cancel.hidden = true; status.textContent = 'Loading music into the editor…';
      if (busy()) throw Error('The editor is busy. Wait until it finishes, then import again.');
      await load(new File([blob], name, { type: 'audio/mpeg' }));
      if (downloadURL) URL.revokeObjectURL(downloadURL);
      downloadURL = URL.createObjectURL(blob); download.href = downloadURL; download.download = name; download.hidden = false;
      status.textContent = `${name} imported.`;
    } catch (error) {
      status.textContent = error.name === 'AbortError' ? 'Import cancelled.' : error.message === 'Failed to fetch' ? 'The audio service is unavailable. Try again shortly.' : error.message;
    } finally { request = null; button.disabled = false; input.disabled = false; cancel.hidden = true; }
  });
  return { cancel() { request?.abort(); } };
}
