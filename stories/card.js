import { createFramer } from '../lib/framer.js';
import { clampCrop } from './crop.js';
import { drawStory, loadImage, photoFrame } from './render.js';
import { decodeReviewPhoto, isReviewPhoto } from './heic.js';

export function createStory(id, { assets, onSelect, onChange, onDownload, say }) {
  const element = document.querySelector('#storyTemplate').content.firstElementChild.cloneNode(true);
  const $ = selector => element.querySelector(selector);
  const canvas = $('.story-canvas'), area = $('.photo-area'), fileInput = $('.story-file');
  const story = {
    id, element, canvas, photo: null, avatar: null, username: '', time: 3, unit: 'm', progress: 19,
    photoName: '', loadingPhoto: false, ratio: 'portrait', adjust: { scale: 1, cx: 0, cy: 0 },
    get ready() { return !!(this.photo && this.avatar && !this.loadingPhoto); },
  };
  let photoRequest = 0, avatarRequest = 0;
  $('.story-select').textContent = `Story ${id}`;
  element.dataset.storyId = id;
  document.querySelector('#storyTrack').append(element);
  const framer = createFramer(area, {
    natural: () => story.photo && ({ nw: story.photo.width, nh: story.photo.height }),
    frame: () => ({ fw: area.clientWidth, fh: area.clientHeight }),
    minScale: () => 1,
    enabled: () => !!story.photo,
    onChange: adjust => {
      const f = photoFrame(canvas.height, story.ratio);
      const bounded = clampCrop(story.photo.width, story.photo.height, f.w, f.h, adjust);
      if (Math.abs(adjust.cx - bounded.cx) > 1e-8 || Math.abs(adjust.cy - bounded.cy) > 1e-8 || adjust.scale !== bounded.scale) {
        framer.adjust = bounded; return;
      }
      story.adjust = bounded; paint();
    },
  });
  story.framer = framer;
  function paint() {
    drawStory(canvas, story, assets);
    canvas.setAttribute('aria-label', `Story ${id}: ${story.username}, ${story.time} ${story.unit === 'm' ? 'minutes' : 'hours'}`);
    $('.empty-photo').hidden = !!story.photo;
    $('.story-save').disabled = !story.ready;
    onChange(story);
  }
  story.paint = paint;
  story.setHeight = height => {
    canvas.height = height;
    const f = photoFrame(height, story.ratio);
    $('.story-preview').style.setProperty('--story-height', height);
    area.style.top = `${f.y / height * 100}%`;
    area.style.width = `${f.w / 1080 * 100}%`;
    area.style.height = `${f.h / height * 100}%`;
    $('.story-dimensions').textContent = `1080 × ${height}`;
    if (story.photo) framer.refresh();
    else paint();
  };
  story.setProfile = async user => {
    if (!user) return;
    const request = ++avatarRequest;
    story.username = user.username; story.avatar = null; paint();
    try {
      const avatar = await loadImage(`profiles/${user.photo}`);
      if (request !== avatarRequest) return;
      story.avatar = avatar; paint();
    } catch {
      if (request === avatarRequest) say(`Story ${id}: profile photo could not load. Choose another profile.`, true);
    }
  };
  story.setPhoto = async file => {
    if (!file) return;
    if (!isReviewPhoto(file)) { say('Choose an image file.', true); return; }
    const request = ++photoRequest;
    story.loadingPhoto = true; paint(); say(`Loading photo for story ${id}…`);
    try {
      const photo = await decodeReviewPhoto(file);
      if (request !== photoRequest) { photo.close(); return; }
      story.photo?.close(); story.photo = photo; story.photoName = file.name || 'Pasted photo';
      framer.reset(); say(`Story ${id} ready.`);
    } catch (error) {
      if (request === photoRequest) {
        const message = error.message?.startsWith('HEIC decoder')
          ? error.message
          : 'This image could not be opened. Try a JPEG, PNG, WebP or HEIC.';
        say(`Story ${id}: ${message}`, true);
      }
    } finally {
      if (request === photoRequest) { story.loadingPhoto = false; paint(); }
    }
  };
  story.pickPhoto = () => fileInput.click();
  element.addEventListener('pointerdown', () => onSelect(story));
  element.addEventListener('focusin', () => onSelect(story));
  $('.story-select').addEventListener('click', () => onSelect(story));
  $('.empty-photo').addEventListener('click', story.pickPhoto);
  fileInput.addEventListener('change', event => { story.setPhoto(event.target.files[0]); event.target.value = ''; });
  $('.story-save').addEventListener('click', () => onDownload([story]));
  element.addEventListener('drop', event => {
    event.preventDefault(); event.stopPropagation();
    document.body.classList.remove('is-over'); onSelect(story); story.setPhoto(event.dataTransfer.files[0]);
  });
  return story;
}
