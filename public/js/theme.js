// Runs before first paint so the page never flashes the wrong theme.
(function () {
  var root = document.documentElement;

  var theme = null;
  try {
    theme = localStorage.getItem('snapshare-theme');
  } catch (e) {}
  if (theme !== 'dark' && theme !== 'light') {
    theme = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  root.setAttribute('data-theme', theme);
  root.setAttribute('data-bs-theme', theme);

  // Animations are always on, whatever the system motion setting says.
  root.setAttribute('data-motion', 'full');
})();
