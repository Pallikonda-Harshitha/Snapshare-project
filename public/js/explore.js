document.addEventListener('DOMContentLoaded', async () => {
  const gallery = document.getElementById('gallery');
  const empty = document.getElementById('empty');
  const more = document.getElementById('more');
  const summary = document.getElementById('summary');
  const qInput = document.getElementById('q');
  const sortSel = document.getElementById('sort');

  const params = new URLSearchParams(location.search);
  const state = {
    q: (params.get('q') || '').trim(),
    category: params.get('category') || '',
    sort: ['newest', 'liked', 'oldest'].includes(params.get('sort')) ? params.get('sort') : 'newest',
    page: 1,
  };
  qInput.value = state.q;
  sortSel.value = state.sort;

  const { categories } = await App.api('/api/meta');
  const chips = document.getElementById('categories');
  chips.innerHTML = ['All', ...categories]
    .map((c) => {
      const value = c === 'All' ? '' : c;
      const kind = value ? App.catClass(value) : 'all';
      return `<button class="chip ${kind} ${value === state.category ? 'on' : ''}" data-cat="${App.esc(value)}">${App.esc(c)}</button>`;
    })
    .join('');

  function syncUrl() {
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.category) p.set('category', state.category);
    if (state.sort !== 'newest') p.set('sort', state.sort);
    history.replaceState(null, '', p.toString() ? '?' + p : location.pathname);
  }

  async function load(reset) {
    if (reset) {
      state.page = 1;
      gallery.innerHTML = App.skeletons(8);
      empty.classList.add('d-none');
      more.classList.add('d-none');
      syncUrl();
    }
    const query = new URLSearchParams({ sort: state.sort, page: state.page, limit: 24 });
    if (state.q) query.set('q', state.q);
    if (state.category) query.set('category', state.category);

    try {
      const data = await App.api('/api/photos?' + query);
      if (state.page === 1) gallery.innerHTML = '';
      gallery.insertAdjacentHTML('beforeend', data.items.map((p) => App.photoTile(p)).join(''));
      empty.classList.toggle('d-none', data.total > 0);
      more.classList.toggle('d-none', state.page >= data.pages);
      summary.textContent = data.total
        ? `${data.total} public photo${data.total === 1 ? '' : 's'}`
        : 'Public photos from the community';
    } catch (err) {
      if (state.page === 1) gallery.innerHTML = '';
      App.toast(err.message, 'danger');
    }
  }

  chips.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    chips.querySelectorAll('.chip').forEach((c) => c.classList.remove('on'));
    btn.classList.add('on');
    state.category = btn.dataset.cat;
    load(true);
  });
  document.getElementById('search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    state.q = qInput.value.trim();
    load(true);
  });
  sortSel.addEventListener('change', () => {
    state.sort = sortSel.value;
    load(true);
  });
  document.addEventListener('photo-deleted', () => load(true));
  more.addEventListener('click', () => {
    state.page += 1;
    load(false);
  });

  load(true);
});
