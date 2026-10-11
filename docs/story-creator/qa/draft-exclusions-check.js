(async () => {
  const root = document.querySelector('#storyWorkspace');
  const $ = selector => root.querySelector(selector);
  const wait = async test => {
    for (let i = 0; i < 200; i++) {
      if (test()) return;
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    throw new Error('Draft exclusion check did not settle');
  };
  let checks = 0;
  const check = (condition, message) => { if (!condition) throw new Error(message); checks++; };
  const card = id => root.querySelector(`[data-story-id="${id}"]`);
  const username = id => /^Story \d+: ([^,]*),/.exec(card(id).querySelector('canvas').getAttribute('aria-label'))?.[1] || '';
  await wait(() => $('#driveProduct').options.length > 1 && window.google?.accounts?.oauth2);
  const product = $('#driveProduct');
  product.selectedIndex = 1; product.dispatchEvent(new Event('change'));
  const originalFetch = window.fetch, originalGoogle = window.google;
  const saved = new Set(), uploads = [];
  let scans = 0;
  window.google = { accounts: { oauth2: { initTokenClient: config => ({ requestAccessToken: () => config.callback({ access_token: 'test-token' }) }) } } };
  window.fetch = async (input, options = {}) => {
    const url = String(input);
    if (url.startsWith('https://www.googleapis.com/upload/drive/v3/files?')) {
      const metadata = JSON.parse((await options.body.text()).split('\r\n\r\n')[1].split('\r\n')[0]);
      uploads.push(metadata);
      saved.add(metadata.properties.instagramUsername.toLowerCase());
      return Response.json({ id: `draft-upload-${uploads.length}`, name: metadata.name });
    }
    if (!url.startsWith('https://www.googleapis.com/drive/v3/')) return originalFetch(input, options);
    if (url.includes('/about?')) return Response.json({ user: { emailAddress: 'team@tenzen.in' } });
    if (options.method === 'PATCH') return Response.json({ id: 'sku', name: 'Product' });
    const query = new URL(url).searchParams.get('q');
    if (query.includes("'root' in parents")) return Response.json({ files: [{ id: 'reviews', name: 'Tenzen Reviews' }] });
    if (query.includes("'reviews' in parents")) return Response.json({ files: [{ id: 'sku', name: 'Product', mimeType: 'application/vnd.google-apps.folder', properties: { shopifyProductId: product.value } }] });
    if (query.includes("'sku' in parents")) {
      scans++;
      return Response.json({ files: [...saved].map((name, index) => ({ id: `saved-${index}`, name: `story-1-${name}-12m.webp`, mimeType: 'image/webp', properties: { instagramUsername: name } })) });
    }
    throw new Error(`Unexpected mocked Drive request: ${url}`);
  };
  try {
    $('#driveConnect').click();
    await wait(() => !$('#randomProfile').disabled && !$('#driveConnect').disabled && username(1));
    const photo = document.createElement('canvas');
    photo.width = 160; photo.height = 90; photo.getContext('2d').fillRect(0, 0, 160, 90);
    const blob = await new Promise(resolve => photo.toBlob(resolve, 'image/png'));
    const addPhoto = id => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([blob], `draft-${id}.png`, { type: 'image/png' }));
      const input = card(id).querySelector('.story-file');
      input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    addPhoto(1);
    await wait(() => !$('#driveSave').disabled);
    const first = username(1);
    $('#addStory').click();
    await wait(() => card(2) && username(2));
    const external = username(2);
    check(first !== external, 'Two drafts reserved the same profile');
    check(card(2).querySelector('.story-save').disabled, 'Second draft unexpectedly has a ready photo');
    saved.add(external);
    $('#driveSave').click();
    await wait(() => uploads.length === 1 && !$('#driveConnect').disabled);
    check(uploads[0].properties.instagramUsername === first, 'First ready story changed its upload identity');
    check(username(1) === first, 'First completed preview was reassigned during upload');
    check(username(2) !== external, 'Externally used unfinished draft retained its identity');
    check(!saved.has(username(2)), 'Unfinished draft was replaced with another saved profile');
    check(![...$('#profile').options].some(option => option.value === external), 'Externally saved user remained selectable');
    $('#addStory').click();
    await wait(() => card(3) && username(3));
    addPhoto(3);
    await wait(() => !$('#driveSave').disabled);
    const third = username(3), scansBefore = scans;
    $('#driveSave').click();
    await wait(() => uploads.length === 2 && !$('#driveConnect').disabled);
    check(scans > scansBefore, 'Second upload skipped the global refresh');
    check(uploads[1].properties.instagramUsername === third, 'Third draft uploaded an incorrect identity');
    check(username(1) === first, 'Later preflight reassigned the earlier completed preview');
    check(username(3) === third, 'Third completed preview lost its uploaded identity');
    check($('#driveSave').disabled, 'Completed previews remained eligible for repeated upload');
    check($('#driveStatus').textContent.includes('1 unfinished story skipped.'), 'Completed preview was counted as an unfinished story');
    $('#profileSearch').value = first; $('#profileSearch').dispatchEvent(new Event('input'));
    check(![...$('#profile').options].some(option => option.value === first), 'Earlier uploaded user remained selectable');
    $('#profileSearch').value = ''; $('#profileSearch').dispatchEvent(new Event('input'));
    return { result: 'PASS', checks, unfinishedDraftReconciled: true, completedPreviewsPreserved: true, uploadedUsersExcluded: true, uploads: uploads.length, scans };
  } finally { window.fetch = originalFetch; window.google = originalGoogle; }
})()
