document.addEventListener('DOMContentLoaded', async () => {
  await App.requireLogin();

  const gallery = document.getElementById('gallery');
  const empty = document.getElementById('empty');
  const summary = document.getElementById('summary');
  const q = document.getElementById('q');
  const visibility = document.getElementById('visibility');
  const category = document.getElementById('category');

  const { categories } = await App.api('/api/meta');
  category.insertAdjacentHTML('beforeend', categories.map((c) => `<option>${App.esc(c)}</option>`).join(''));

  async function load() {
    const params = new URLSearchParams({ limit: 60 });
    if (q.value.trim()) params.set('q', q.value.trim());
    if (visibility.value) params.set('visibility', visibility.value);
    if (category.value) params.set('category', category.value);
    try {
      const data = await App.api('/api/photos/mine?' + params);
      gallery.innerHTML = data.items.map((p) => App.photoTile(p, { showBadge: true })).join('');
      empty.classList.toggle('d-none', data.total > 0);
      summary.textContent = `${data.total} photo${data.total === 1 ? '' : 's'}`;
      document.getElementById('sample-banner').classList.toggle('d-none', !data.sampleCount);
    } catch (err) {
      App.toast(err.message, 'danger');
    }
  }

  let timer;
  q.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(load, 250);
  });
  document.getElementById('remove-samples').addEventListener('click', async () => {
    const ok = await App.confirm({
      title: 'Remove all sample photos?',
      message: 'Only the sample photos are removed. Anything you uploaded yourself stays.',
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    try {
      const { removed } = await App.api('/api/photos/samples', { method: 'DELETE' });
      App.toast(`${removed} sample photo${removed === 1 ? '' : 's'} removed`);
      load();
    } catch (err) {
      App.toast(err.message, 'danger');
    }
  });
  visibility.addEventListener('change', load);
  document.addEventListener('photo-deleted', load);
  category.addEventListener('change', load);
  load();
});
