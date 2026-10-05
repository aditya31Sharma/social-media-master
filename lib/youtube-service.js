const HQ = 'https://dashboard.tenzen.in';
const PATH = '/social-media-master/api/youtube-audio';
let authorization = null;
export function youtubeService(location = window.location) {
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  return { endpoint: local ? new URL('./api/youtube-audio', location.href).href : HQ + PATH, needsSignIn: !local && location.origin !== HQ };
}
function signIn(signal, status, endpoint) {
  if (authorization && authorization.expires > Date.now()) return Promise.resolve(authorization.token);
  if (!('BroadcastChannel' in window)) return Promise.reject(Error('Open Social Media Master through Tenzen HQ to import audio in this browser.'));
  const state = [...crypto.getRandomValues(new Uint8Array(16))].map(value => value.toString(16).padStart(2, '0')).join('');
  const channel = new BroadcastChannel(`smm-audio-${state}`);
  const target = new URL(endpoint + '/authorize'); target.search = new URLSearchParams({ origin: location.origin, state });
  const popup = window.open(target, '_blank');
  if (!popup) { channel.close(); return Promise.reject(Error('Allow the sign-in tab, then click Import audio again.')); }
  status('Sign in to Tenzen HQ in the new tab. Your reel stays here.');
  return new Promise((resolve, reject) => {
    const finish = (error, token) => { clearTimeout(timer); signal.removeEventListener('abort', abort); channel.close(); if (error) reject(error); else resolve(token); };
    const abort = () => { popup.close(); finish(new DOMException('Import cancelled.', 'AbortError')); };
    const timer = setTimeout(() => finish(Error('Sign-in timed out. Click Import audio to try again.')), 180000);
    signal.addEventListener('abort', abort, { once: true });
    channel.onmessage = event => {
      if (event.data?.state !== state || event.data?.type !== 'audio-authorized' || typeof event.data.token !== 'string') return;
      authorization = { token: event.data.token, expires: Date.now() + 9 * 60000 };
      channel.postMessage({ state, type: 'audio-received' });
      finish(null, authorization.token);
    };
    if (signal.aborted) abort();
  });
}
export async function fetchYouTubeAudio(url, signal, status) {
  const service = youtubeService();
  const token = service.needsSignIn ? await signIn(signal, status, service.endpoint) : null;
  signal.throwIfAborted(); status('Getting audio from YouTube…');
  const response = await fetch(service.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ url }), signal, credentials: service.needsSignIn ? 'omit' : 'same-origin' });
  if (response.status === 401) authorization = null;
  return response;
}
