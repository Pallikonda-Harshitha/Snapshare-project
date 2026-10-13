document.addEventListener('DOMContentLoaded', async () => {
  const id = new URLSearchParams(location.search).get('id');
  const $ = (sel) => document.getElementById(sel);
  const missing = () => $('missing').classList.remove('d-none');
  if (!id) return missing();

  let album;
  let photos;

  async function load() {
    ({ album, photos } = await App.api('/api/albums/' + encodeURIComponent(id)));
  }

  function render() {
    document.title = album.name + ' · SnapShare';
    $('name').textContent = album.name;
    $('description').textContent = album.description;
    $('description').classList.toggle('d-none', !album.description);
    $('meta').textContent = `By ${album.owner.name} · ${photos.length} post${photos.length === 1 ? '' : 's'}`;
    $('badge').innerHTML =
      album.visibility === 'public'
        ? '<i class="bi bi-globe2"></i> Public album'
        : '<i class="bi bi-lock"></i> Private album';
    $('gallery').innerHTML = photos.map((p) => App.photoTile(p, { showBadge: album.isOwner })).join('');
    $('empty').classList.toggle('d-none', photos.length > 0);
    $('owner-tools').classList.toggle('d-none', !album.isOwner);
    $('add-photo').href = '/upload.html?album=' + encodeURIComponent(album.id);
    $('toggle-vis').innerHTML =
      album.visibility === 'public'
        ? '<i class="bi bi-lock"></i> Make private'
        : '<i class="bi bi-globe2"></i> Make public';
  }

  try {
    await load();
  } catch {
    return missing();
  }
  $('content').classList.remove('d-none');
  render();

  $('toggle-vis').addEventListener('click', async () => {
    const next = album.visibility === 'public' ? 'private' : 'public';
    try {
      await App.api('/api/albums/' + album.id, { method: 'PATCH', body: { visibility: next } });
      await load();
      render();
      App.toast(next === 'public' ? 'Album is now public' : 'Album is now private');
    } catch (err) {
      App.toast(err.message, 'danger');
    }
  });

  $('delete').addEventListener('click', async () => {
    const ok = await App.confirm({
      title: 'Delete this album?',
      message: `"${album.name}" will be removed. Its posts are kept and stay in your library.`,
    });
    if (!ok) return;
    try {
      await App.api('/api/albums/' + album.id, { method: 'DELETE' });
      location.href = '/albums.html';
    } catch (err) {
      App.toast(err.message, 'danger');
    }
  });
});
