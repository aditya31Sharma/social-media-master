(async () => {
  const $ = selector => document.querySelector(selector);
  const wait = async test => {
    for (let i = 0; i < 100; i++) {
      if (test()) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('Timed out waiting for Drive scan');
  };
  const users = await (await fetch('profiles/users.json')).json();
  const excluded = users.slice(1, 12).map(user => user.username);
  const product = $('#driveProduct');
  await wait(() => product.options.length > 1);
  product.selectedIndex = 1;
  product.dispatchEvent(new Event('change'));
  const selectedId = product.value;
  window.google = { accounts: { oauth2: { initTokenClient: config => ({ requestAccessToken: () => config.callback({ access_token: 'test-token' }) }) } } };
  const originalFetch = window.fetch;
  window.fetch = async (input, options = {}) => {
    const url = String(input);
    if (url.startsWith('https://www.googleapis.com/upload/drive/v3/files?')) return Response.json({ id: 'new-story', name: 'saved.webp' });
    if (!url.startsWith('https://www.googleapis.com/drive/v3/')) return originalFetch(input, options);
    if (url.includes('/about?')) return Response.json({ user: { emailAddress: 'team@tenzen.in' } });
    if (options.method === 'PATCH') return Response.json({ id: 'product1', name: 'Updated product' });
    const query = new URL(url).searchParams.get('q');
    if (query.includes("'root' in parents")) return Response.json({ files: [{ id: 'root1', name: 'Tenzen Reviews' }] });
    if (query.includes("'root1' in parents")) return Response.json({ files: [{ id: 'product1', name: 'Mock product', properties: { shopifyProductId: selectedId } }] });
    if (query.includes("'product1' in parents")) return Response.json({ files: excluded.map((name, i) => ({ id: `file${i}`, name: `story-${i + 1}-${name}-12m.webp`, mimeType: 'image/webp' })) });
    throw new Error(`Unexpected Drive request ${url}`);
  };
  $('#driveConnect').click();
  await wait(() => !$('#randomProfile').disabled);
  if ($('#profile').options.length !== 600) throw new Error('Manual picker lost profiles');
  if (!$('#driveStatus').textContent.includes('11 saved WebPs')) throw new Error('Saved count missing');
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
  const newUser = users[20].username;
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
  if (!$('#randomProfileNote').textContent.startsWith('12 saved users')) throw new Error('New save did not update exclusions');
  const chosen = new Set([...excluded, newUser]);
  for (let i = 0; i < 25; i++) {
    $('#randomProfile').click();
    if (chosen.has($('#profile').value)) throw new Error('Randomize selected a saved username after upload');
  }
  return { result: 'PASS', priorSavedCount: 11, excludedAfterSave: 12, randomClicks: 50, manualProfiles: $('#profile').options.length };
})()
