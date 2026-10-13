document.addEventListener('DOMContentLoaded', async () => {
  await App.requireLogin();

  const grid = document.getElementById('grid');
  const empty = document.getElementById('empty');
  const errorBox = document.getElementById('album-error');

  async function load() {
    try {
      const { albums } = await App.api('/api/albums');
      empty.classList.toggle('d-none', albums.length > 0);
      grid.innerHTML = albums
        .map(
          (a) => `
          <div class="col-6 col-md-4 col-lg-3">
            <a class="album-card" href="/album.html?id=${encodeURIComponent(a.id)}">
              <div class="album-cover">${a.cover ? `<img src="${App.esc(a.cover)}" alt="" loading="lazy">` : '<i class="bi bi-images"></i>'}</div>
              <div class="mt-2 fw-medium">${App.esc(a.name)}</div>
              <div class="small text-secondary">${a.photoCount} photo${a.photoCount === 1 ? '' : 's'} ·
                <i class="bi ${a.visibility === 'public' ? 'bi-globe2' : 'bi-lock'}"></i> ${a.visibility === 'public' ? 'Public' : 'Private'}</div>
            </a>
          </div>`
        )
        .join('');
    } catch (err) {
      App.toast(err.message, 'danger');
    }
  }

  document.getElementById('album-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.classList.add('d-none');
    try {
      await App.api('/api/albums', {
        method: 'POST',
        body: {
          name: document.getElementById('a-name').value,
          description: document.getElementById('a-desc').value,
          visibility: document.getElementById('a-vis').value,
        },
      });
      e.target.reset();
      bootstrap.Modal.getInstance(document.getElementById('album-modal')).hide();
      App.toast('Album created');
      load();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.remove('d-none');
    }
  });

  load();
});
