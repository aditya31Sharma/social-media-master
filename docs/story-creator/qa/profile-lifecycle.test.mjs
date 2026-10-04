import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function makeStory() {
  const pending = [];
  const nodes = new Map();
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { style: { setProperty() {} }, setAttribute() {}, addEventListener() {} });
    return nodes.get(selector);
  };
  const element = { querySelector: node, dataset: {}, addEventListener() {} };
  const root = { querySelector: selector => selector === '#storyTemplate'
    ? { content: { firstElementChild: { cloneNode: () => element } } } : { append() {} } };
  const context = vm.createContext({ URL, document: {}, createFramer: () => ({}), clampCrop() {}, drawStory() {}, photoFrame() {},
    loadImage: () => new Promise(resolve => pending.push(resolve)) });
  const source = readFileSync(new URL('../../../stories/card.js', import.meta.url), 'utf8');
  vm.runInContext(source.replace(/^import .*;$/gm, '').replace(/^export /gm, '').replaceAll('import.meta.url', '"http://localhost/stories/card.js"') + '\nglobalThis.create = createStory;', context);
  const story = context.create(1, { assets: {}, root, onChange() {}, onSelect() {}, onDownload() {}, say() {} });
  return { story, pending };
}

test('clearing a profile cancels an in-flight avatar and keeps the story unready', async () => {
  const { story, pending } = makeStory();
  story.photo = {};
  const loading = story.setProfile({ username: 'already-used', photo: 'old.jpg' });
  await story.setProfile(null);
  pending[0]({ tag: 'old avatar' }); await loading;
  assert.equal(story.username, '');
  assert.equal(story.avatar, null);
  assert.equal(story.ready, false);
});

test('rapid profile changes cannot show an avatar belonging to the earlier user', async () => {
  const { story, pending } = makeStory();
  const old = story.setProfile({ username: 'old', photo: 'old.jpg' });
  const current = story.setProfile({ username: 'unused', photo: 'new.jpg' });
  pending[1]({ tag: 'new avatar' }); await current;
  pending[0]({ tag: 'old avatar' }); await old;
  assert.equal(story.username, 'unused');
  assert.equal(story.avatar.tag, 'new avatar');
});
