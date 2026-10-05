const params = new URLSearchParams(location.hash.slice(1));
const state = params.get('state'), token = params.get('token');
history.replaceState(null, '', location.pathname);
const status = document.querySelector('[role=status]');
if (!/^[a-f0-9]{32}$/.test(state || '') || !token || token.length > 2048 || !('BroadcastChannel' in window)) {
  status.textContent = 'Return to the reel editor and click Import audio again.';
} else {
  const channel = new BroadcastChannel(`smm-audio-${state}`);
  const send = () => channel.postMessage({ type: 'audio-authorized', state, token });
  const repeat = setInterval(send, 500);
  const timeout = setTimeout(() => { clearInterval(repeat); channel.close(); status.textContent = 'Return to the reel editor and try Import audio again.'; }, 120000);
  channel.onmessage = event => {
    if (event.data?.type !== 'audio-received' || event.data.state !== state) return;
    clearInterval(repeat); clearTimeout(timeout); channel.close();
    document.querySelector('h1').textContent = 'Audio import connected';
    status.textContent = 'Return to your reel editor. The audio is importing.';
    window.close();
  };
  send();
}
