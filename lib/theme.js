/* Aditya Tools Design System: remember System, Light or Dark independently of OS changes. */
(() => {
  const key = 'social-media-master:theme';
  const media = matchMedia('(prefers-color-scheme: dark)');
  let preference = 'light';
  try { preference = localStorage.getItem(key) || 'light'; }
  catch { /* Appearance still works when browser storage is unavailable. */ }
  if (!['system', 'light', 'dark'].includes(preference)) preference = 'light';
  function apply() {
    const theme = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0E0E0E' : '#FFFFFF');
    document.querySelectorAll('[data-theme-choice]').forEach(button => {
      const selected = button.dataset.themeChoice === preference;
      button.classList.toggle('is-on', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }
  apply();
  media.addEventListener('change', apply);
  document.addEventListener('DOMContentLoaded', apply);
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-theme-choice]');
    if (!button) return;
    preference = button.dataset.themeChoice;
    try { localStorage.setItem(key, preference); }
    catch { /* The current session keeps the selected appearance. */ }
    apply();
  });
})();
