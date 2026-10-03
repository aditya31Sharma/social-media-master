import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';

const source = await readFile(new URL('../../coi-serviceworker.js', import.meta.url), 'utf8');
const scope = 'https://example.test/social-media-master/';

async function responseFor(path, mode = 'navigate') {
  const handlers = {};
  const self = { registration: { scope }, addEventListener: (name, callback) => { handlers[name] = callback; } };
  vm.runInNewContext(source, {
    self, URL, Headers, Response, console,
    fetch: async () => new Response('workspace', { headers: {
      'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'credentialless',
    } }),
  });
  let response;
  handlers.fetch({ request: { url: new URL(path, scope).href, mode, cache: 'default' }, respondWith: value => { response = value; } });
  return response;
}

test('shared workspace allows the Drive sign-in popup, including after old isolation headers', async () => {
  for (const path of ['', 'index.html', '?preview=1#story']) {
    const response = await responseFor(path);
    assert.equal(response.headers.get('Cross-Origin-Opener-Policy'), null);
    assert.equal(response.headers.get('Cross-Origin-Embedder-Policy'), null);
  }
});

test('Reel lab retains its isolation headers', async () => {
  const response = await responseFor('lab/');
  assert.equal(response.headers.get('Cross-Origin-Opener-Policy'), 'same-origin');
  assert.equal(response.headers.get('Cross-Origin-Embedder-Policy'), 'credentialless');
});

test('legacy Story URL and assets pass through', async () => {
  assert.equal(await responseFor('stories/'), undefined);
  assert.equal(await responseFor('stories/profiles/users.json', 'cors'), undefined);
});
