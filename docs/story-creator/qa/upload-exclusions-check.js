(async () => {
  const $ = selector => document.querySelector('#storyWorkspace').querySelector(selector);
  const wait = async test => {
    for (let i = 0; i < 150; i++) {
      if (test()) return;
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    throw new Error('Upload guard did not settle');
  };
  await wait(() => $('#driveProduct').options.length > 1);
  const product = $('#driveProduct');
  product.selectedIndex = 1; product.dispatchEvent(new Event('change'));
  const originalFetch = window.fetch, originalGoogle = window.google;
  const saved = new Set();
  let failScan = false, uploads = 0, scans = 0, holdScan = false, releaseScan;
  const uploadMetadata = [];
  window.google = { accounts: { oauth2: { initTokenClient: config => ({ requestAccessToken: () => config.callback({ access_token: 'test-token' }) }) } } };
  window.fetch = async (input, options = {}) => {
    const url = String(input);
    if (url.startsWith('https://www.googleapis.com/upload/drive/v3/files?')) {
      uploads++;
      uploadMetadata.push(JSON.parse((await options.body.text()).split('\r\n\r\n')[1].split('\r\n')[0]));
      return Response.json({ id: `upload${uploads}`, name: 'saved.webp' });
    }
    if (!url.startsWith('https://www.googleapis.com/drive/v3/')) return originalFetch(input, options);
    if (url.includes('/about?')) return Response.json({ user: { emailAddress: 'team@tenzen.in' } });
    if (options.method === 'PATCH') return Response.json({ id: 'sku', name: 'Product' });
    const query = new URL(url).searchParams.get('q');
    if (query.includes("'root' in parents")) return Response.json({ files: [{ id: 'reviews', name: 'Tenzen Reviews' }] });
    if (query.includes("'reviews' in parents")) return Response.json({ files: [{ id: 'sku', name: 'Product', mimeType: 'application/vnd.google-apps.folder', properties: { shopifyProductId: product.value } }] });
    if (query.includes("'sku' in parents")) {
      scans++;
      if (failScan) return Response.json({ error: { message: 'Folder unavailable' } }, { status: 503 });
      if (holdScan) {
        holdScan = false;
        await new Promise(resolve => { releaseScan = resolve; });
      }
      return Response.json({ files: [...saved].map((username, i) => ({ id: `saved${i}`, name: `story-1-${username}-12m.webp`, mimeType: 'image/webp' })) });
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  try {
    $('#driveConnect').click();
    await wait(() => !$('#randomProfile').disabled);
    const photo = document.createElement('canvas');
    photo.width = 160; photo.height = 90; photo.getContext('2d').fillRect(0, 0, 160, 90);
    const blob = await new Promise(resolve => photo.toBlob(resolve, 'image/png'));
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], 'review.png', { type: 'image/png' }));
    $('.story-file').files = transfer.files;
    $('.story-file').dispatchEvent(new Event('change', { bubbles: true }));
    await wait(() => !$('#driveSave').disabled);
    const externalUser = $('#profile').value;
    saved.add(externalUser);
    $('#driveSave').click();
    await wait(() => $('#driveStatus').textContent.includes('already has a saved story'));
    if (uploads || [...$('#profile').options].some(option => option.value === externalUser)) throw new Error('Externally saved user was uploaded or remained selectable');
    await wait(() => !$('#driveSave').disabled);
    failScan = true;
    $('#driveSave').click();
    await wait(() => $('#driveStatus').textContent.includes('Folder unavailable'));
    if (uploads || !$('#driveSave').disabled || !$('#randomProfile').disabled || !$('#profile').disabled) throw new Error('Pre-upload scan failure reused cached exclusions');
    failScan = false;
    $('#driveConnect').click();
    await wait(() => !$('#driveSave').disabled);
    const uploadedUser = $('#profile').value, beforeSave = scans;
    $('#driveSave').click();
    await wait(() => $('#driveStatus').textContent.startsWith('Saved 1 WebPs'));
    if (uploads !== 1 || scans <= beforeSave || !$('#driveSave').disabled) throw new Error('Upload skipped its fresh scan or allowed a repeated save');
    if ([...$('#profile').options].some(option => option.value === uploadedUser)) throw new Error('Uploaded profile remains selectable');
    saved.add(uploadedUser);
    $('#randomProfile').click();
    await wait(() => !$('#driveSave').disabled);
    const snapshotUser = $('#profile').value;
    holdScan = true; $('#driveSave').click();
    await wait(() => releaseScan);
    $('#randomProfile').click();
    if ($('#profile').value === snapshotUser) throw new Error('Profile did not change while scan was pending');
    releaseScan();
    await wait(() => uploads === 2 && !$('#driveConnect').disabled);
    const metadata = uploadMetadata[1];
    if (metadata.properties.instagramUsername !== snapshotUser || !metadata.name.includes(`-${snapshotUser}-`)) throw new Error('Pending upload changed its profile snapshot');
    return { result: 'PASS', externalSaveBlocked: true, failedPreflightBlocked: true, reconnectRecovered: true, rescannedBeforeUpload: true, repeatSaveBlocked: true, pendingUploadSnapshotPreserved: true, uploads, scans };
  } finally { window.fetch = originalFetch; window.google = originalGoogle; }
})()
