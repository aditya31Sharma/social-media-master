import { loadAssets } from './render.js';
import { createStory } from './card.js';
import { downloadStories } from './download.js';
import { setupDrive } from './drive-ui.js';
import { isReviewPhoto } from './heic.js';
import { normalizeUsername } from './saved-users.js';

export async function mountStory(root, { isActive = () => true } = {}) {
const $ = selector => root.querySelector(selector);

const stories = [];
let assets = null, users = [], active = null, exporting = false;
let savedUsers = null;
let driveUI;
// Load before wiring listeners so a failed mount can be retried cleanly.
const response = await fetch(new URL('profiles/users.json', import.meta.url), { signal: AbortSignal.timeout(15000) });
if (!response.ok) throw new Error('Profiles could not load.');
users = await response.json();
assets = await loadAssets();
const randomChoices = () => users.filter(user => user.username !== active?.username && !savedUsers?.has(normalizeUsername(user.username)));
function setSavedUsers(usernames) {
  savedUsers = usernames;
  $('#randomProfileNote').textContent = usernames
    ? `${usernames.size} saved ${usernames.size === 1 ? 'user' : 'users'} excluded from Randomize across all products.`
    : 'Connect Google Drive and complete the global check to randomize unused users.';
  refresh(active);
}

function say(message, error = false) {
  $('#storyStatus').textContent = message;
  $('#storyStatus').dataset.error = String(error);
}
function refresh(story) {
  if (story && story === active) {
    $('#photoName').textContent = story.photoName || '⌘V / Ctrl+V to paste a photo.';
    $('#upload').firstChild.textContent = story.photo ? 'Replace photo ' : 'Add a photo ';
    $('#zoom').disabled = $('#resetPhoto').disabled = !story.photo;
    $('#zoom').value = story.adjust.scale;
    $('#zoomValue').textContent = `${Math.round(story.adjust.scale * 100)}%`;
  }
  const valid = $('#timeValue').checkValidity() && $('#progressValue').checkValidity();
  $('#download').disabled = exporting || !active?.ready || !valid;
  $('#randomProfile').disabled = !active || !savedUsers || !randomChoices().length;
  $('#downloadAll').disabled = exporting || !stories.some(story => story.ready) || !valid;
  stories.forEach(story => { story.element.querySelector('.story-save').disabled = exporting || !story.ready; });
  const ready = stories.filter(story => story.ready).length;
  $('#storyCount').textContent = `${stories.length} ${stories.length === 1 ? 'story' : 'stories'} · ${ready} ready`;
  driveUI?.refresh();
}
function showUnits() {
  root.querySelectorAll('[data-unit]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.unit === active?.unit)));
}
function filterProfiles(selectFirst = true) {
  const query = $('#profileSearch').value.trim().toLowerCase().replace(/^@/, '');
  const matches = users.filter(user => user.username.toLowerCase().includes(query));
  $('#profile').replaceChildren(...matches.map(user => new Option(`@${user.username}`, user.username)));
  if (!matches.length) $('#profile').add(new Option('No matching profiles', ''));
  $('#profile').disabled = !matches.length;
  if (matches.some(user => user.username === active?.username)) $('#profile').value = active.username;
  else if (selectFirst && matches.length) active?.setProfile(matches[0]);
  $('#profileCount').textContent = `${matches.length} of ${users.length} profiles`;
}
function select(story) {
  if (active === story) return;
  active = story;
  stories.forEach(item => {
    item.element.classList.toggle('is-selected', item === story);
    item.element.querySelector('.story-select').setAttribute('aria-pressed', String(item === story));
  });
  $('#editingStory').textContent = `Editing story ${story.id}`;
  $('#timeValue').value = story.time; $('#format').value = story.canvas.height;
  $('#photoRatio').value = story.ratio;
  $('#progress').value = $('#progressValue').value = story.progress;
  $('#profileSearch').value = ''; filterProfiles(false); showUnits(); refresh(story);
}
function addStory() {
  const height = Number($('#format').value);
  const story = createStory(stories.length + 1, { assets, onSelect: select, onChange: refresh, onDownload: download, say, root });
  stories.push(story); story.setHeight(height); select(story); story.setProfile(users[0]);
  if (stories.length > 1) story.element.scrollIntoView({ block: 'nearest', inline: 'end' });
  say(`Story ${story.id}: paste or upload a review photo.`);
}
async function download(list) {
  if (exporting) return;
  const ready = list.filter(story => story.ready);
  if (!ready.length) return;
  exporting = true; refresh(active); say(`Preparing ${ready.length} WebP ${ready.length === 1 ? 'file' : 'files'}…`);
  try {
    const count = await downloadStories(ready), skipped = list.length - ready.length;
    say(`Download started for ${count} WebP ${count === 1 ? 'file' : 'files'}.${skipped ? ` ${skipped} unfinished ${skipped === 1 ? 'story' : 'stories'} skipped.` : ''}`);
  } catch (error) { say(error.message, true); }
  finally { exporting = false; refresh(active); }
}
$('#addStory').addEventListener('click', addStory);
$('#downloadAll').addEventListener('click', () => download([...stories]));
$('#download').addEventListener('click', () => download([active]));
$('#upload').addEventListener('click', () => active?.pickPhoto());
$('#profileSearch').addEventListener('input', () => filterProfiles());
$('#profile').addEventListener('change', () => active?.setProfile(users.find(user => user.username === $('#profile').value)));
$('#randomProfile').addEventListener('click', () => {
  if (!active) return;
  const choices = savedUsers ? randomChoices() : [];
  if (!choices.length) return;
  const user = choices[Math.floor(Math.random() * choices.length)];
  active.setProfile(user);
  $('#profileSearch').value = ''; filterProfiles(false);
});
window.addEventListener('paste', event => {
  if (!isActive() || event.target.closest?.('input, textarea, [contenteditable=true]')) return;
  const item = [...(event.clipboardData?.items || [])].find(item => isReviewPhoto(item.getAsFile()));
  if (item && active) { event.preventDefault(); active.setPhoto(item.getAsFile()); }
});
window.addEventListener('dragover', event => {
  if (!isActive()) return;
  if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); document.body.classList.add('is-over'); }
});
window.addEventListener('dragleave', event => { if (!event.relatedTarget) document.body.classList.remove('is-over'); });
window.addEventListener('drop', event => {
  if (!isActive()) return;
  event.preventDefault(); document.body.classList.remove('is-over'); active?.setPhoto(event.dataTransfer.files[0]);
});
$('#timeValue').addEventListener('input', () => {
  if (active && $('#timeValue').checkValidity()) { active.time = Number($('#timeValue').value); active.paint(); }
  refresh(active);
});
$('#timeValue').addEventListener('change', () => {
  if (!active) return;
  active.time = Math.min(60, Math.max(1, Math.round(Number($('#timeValue').value) || 1)));
  $('#timeValue').value = active.time; active.paint();
});
$('#randomTime').addEventListener('click', () => {
  if (!active) return;
  active.time = Math.floor(Math.random() * 60) + 1; $('#timeValue').value = active.time; active.paint();
});
function setProgress(value) {
  if (!active) return;
  active.progress = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  $('#progress').value = $('#progressValue').value = active.progress;
  active.paint();
}
$('#progress').addEventListener('input', () => setProgress($('#progress').value));
$('#progressValue').addEventListener('input', () => {
  if ($('#progressValue').checkValidity()) setProgress($('#progressValue').value);
  else refresh(active);
});
$('#progressValue').addEventListener('change', () => setProgress($('#progressValue').value));
$('#randomProgress').addEventListener('click', () => setProgress(Math.floor(Math.random() * 101)));
root.querySelectorAll('[data-unit]').forEach(button => button.addEventListener('click', () => {
  if (!active) return;
  active.unit = button.dataset.unit; showUnits(); active.paint();
}));
driveUI = setupDrive(() => stories, setSavedUsers, root);
$('#zoom').addEventListener('input', () => active?.framer.setZoom(Number($('#zoom').value)));
$('#resetPhoto').addEventListener('click', () => active?.framer.reset());
$('#format').addEventListener('change', () => active?.setHeight(Number($('#format').value)));
$('#photoRatio').addEventListener('change', () => {
  if (!active) return;
  active.ratio = $('#photoRatio').value; active.setHeight(active.canvas.height);
});
$('#profileSearch').disabled = $('#addStory').disabled = false; addStory();
$('#progress').disabled = $('#progressValue').disabled = $('#randomProgress').disabled = false;
return { addStory, refresh: () => refresh(active) };
}
