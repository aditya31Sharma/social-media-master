(async () => {
  const $ = selector => document.querySelector('#storyWorkspace').querySelector(selector);
  const wait = async test => {
    for (let i = 0; i < 100; i++) {
      if (test()) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('Timed out waiting for Drive scan');
  };
  const users = await (await fetch('stories/profiles/users.json')).json();
  const excluded = users.slice(1, 26).map(user => user.username);
  const product = $('#driveProduct');
  await wait(() => product.options.length > 1);
  const selectedId = product.options[1].value;
  if (product.value) throw new Error('Test requires no selected product');
  const originalGoogle = window.google;
  let failScan = false, scanRequests = 0;
  const mockGoogle = { accounts: { oauth2: { initTokenClient: config => ({ requestAccessToken: () => config.callback({ access_token: 'test-token' }) }) } } };
  window.google = mockGoogle;
  const originalFetch = window.fetch;
  window.fetch = async (input, options = {}) => {
    const url = String(input);
    if (url.startsWith('https://www.googleapis.com/upload/drive/v3/files?')) return Response.json({ id: 'new-story', name: 'saved.webp' });
    if (!url.startsWith('https://www.googleapis.com/drive/v3/')) return originalFetch(input, options);
    if (url.includes('/about?')) return Response.json({ user: { emailAddress: 'team@tenzen.in' } });
    if (options.method === 'PATCH') return Response.json({ id: 'product1', name: 'Updated product' });
    const query = new URL(url).searchParams.get('q');
    if (query.includes("'root' in parents")) return Response.json({ files: [{ id: 'root1', name: 'Tenzen Reviews' }] });
    if (query.includes("'root1' in parents")) return Response.json({ files: Array.from({ length: 5 }, (_, i) => ({ id: `product${i + 1}`, name: `Mock product ${i + 1}`, mimeType: 'application/vnd.google-apps.folder', properties: { shopifyProductId: i === 0 ? selectedId : `other${i}` } })) });
    const group = /'product(\d)' in parents/.exec(query);
    if (group) {
      scanRequests++;
      if (failScan && group[1] === '5') return Response.json({ error: { message: 'Folder unavailable' } }, { status: 403 });
      const offset = (Number(group[1]) - 1) * 5;
      return Response.json({ files: excluded.slice(offset, offset + 5).map((name, i) => ({ id: `file${offset + i}`, name: `story-${i + 1}-${name}-12m.webp`, mimeType: 'image/webp' })) });
    }
    throw new Error(`Unexpected Drive request ${url}`);
  };
  $('#driveConnect').click();
  await wait(() => !$('#randomProfile').disabled);
  if ($('#profile').options.length !== 600) throw new Error('Manual picker lost profiles');
  if (!$('#driveConnectionNote').textContent.includes('25 saved WebPs across Tenzen Reviews')) throw new Error('Saved count missing');
  const random = Math.random;
  try {
    Math.random = () => 0;
    for (let i = 0; i < 25; i++) {
      $('#randomProfile').click();
      if (excluded.includes($('#profile').value)) throw new Error('Randomize selected saved username');
    }
  } finally { Math.random = random; }
  $('#profile').value = excluded[0];
  $('#profile').dispatchEvent(new Event('change'));
  if ($('#profile').value !== excluded[0]) throw new Error('Manual selection blocked');
  const newUser = users[40].username;
  product.selectedIndex = 1;
  product.dispatchEvent(new Event('change'));
  if ($('#randomProfile').disabled || scanRequests !== 5) throw new Error('Product selection changed global exclusions');
  $('#profile').value = newUser;
  $('#profile').dispatchEvent(new Event('change'));
  const photo = document.createElement('canvas');
  photo.width = 160; photo.height = 90;
  photo.getContext('2d').fillRect(0, 0, 160, 90);
  const blob = await new Promise(resolve => photo.toBlob(resolve, 'image/png'));
  const transfer = new DataTransfer();
  transfer.items.add(new File([blob], 'review.png', { type: 'image/png' }));
  const input = $('.story-file');
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await wait(() => !$('#driveSave').disabled);
  $('#driveSave').click();
  await wait(() => $('#driveStatus').textContent.startsWith('Saved 1 WebPs'));
  if (!$('#randomProfileNote').textContent.startsWith('26 saved users')) throw new Error('New save did not update exclusions');
  product.selectedIndex = 2; product.dispatchEvent(new Event('change'));
  $('#driveSearch').value = 'no-such-product'; $('#driveSearch').dispatchEvent(new Event('input'));
  if ($('#randomProfile').disabled || scanRequests !== 5) throw new Error('Switching or clearing product reset global exclusions');
  const chosen = new Set([...excluded, newUser]);
  for (let i = 0; i < 25; i++) {
    $('#randomProfile').click();
    if (chosen.has($('#profile').value)) throw new Error('Randomize selected a saved username after upload');
  }
  failScan = true; window.google = mockGoogle; $('#driveConnect').click();
  if (!$('#randomProfile').disabled) throw new Error('Reconnect reused stale exclusions');
  await wait(() => !$('#driveConnect').disabled);
  if (!$('#randomProfile').disabled || !$('#driveSave').disabled || !$('#driveConnectionNote').textContent.includes('Could not check all saved stories')) throw new Error('Partial global scan enabled randomize or hid failure');
  window.fetch = originalFetch; window.google = originalGoogle;
  return { result: 'PASS', folders: 5, priorSavedCount: 25, excludedAfterSave: 26, randomClicks: 50, productIndependent: true, partialScanBlocked: true, manualProfiles: $('#profile').options.length };
})()
