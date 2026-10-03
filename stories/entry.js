// Keep saved Story links pointed at the shared workspace.
const workspace = new URL('../', import.meta.url);
workspace.hash = 'story';
location.replace(workspace.href);
