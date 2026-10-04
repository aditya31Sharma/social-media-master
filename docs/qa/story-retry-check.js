// Run on a fresh Carousel page before Story has mounted.
(async () => {
  const $ = selector => document.querySelector(selector);
  const original = window.fetch;
  const wait = async predicate => {
    for (let i = 0; i < 300; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 50)); }
    throw new Error('Story retry timed out');
  };
  try {
    window.fetch = (url, options) => String(url).includes('profiles/users.json')
      ? Promise.resolve(new Response('Temporarily unavailable', { status: 503 })) : original(url, options);
    $('#tabStory').click();
    await wait(() => !$('#retryStory').hidden);
    if ($('.story-editor')) throw new Error('Partial editor left behind after failure');
    window.fetch = original;
    $('#retryStory').click();
    await wait(() => [...($('#profile')?.options || [])].filter(o => o.value).length === 600);
    if (document.querySelectorAll('.story-editor').length !== 1 || document.querySelectorAll('.story-card').length !== 1) throw new Error('Retry duplicated the editor');
    $('#addStory').click();
    if (document.querySelectorAll('.story-card').length !== 2) throw new Error('Retry duplicated event listeners');
    return { passed: 3, checks: ['Failure offers retry', 'Retry restores one editor and 600 profiles', 'One click adds exactly one story'] };
  } finally { window.fetch = original; }
})()
