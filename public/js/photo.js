document.addEventListener('DOMContentLoaded', async () => {
  const id = new URLSearchParams(location.search).get('id');
  const $ = (sel) => document.getElementById(sel);
  const missing = () => $('missing').classList.remove('d-none');
  if (!id) return missing();

  const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const MAX_SIZE = 10 * 1024 * 1024;
  const MAX_IMAGES = 10;

  let photo;
  try {
    photo = (await App.api('/api/photos/' + encodeURIComponent(id))).photo;
  } catch {
    return missing();
  }

  const user = await App.currentUser();
  const albumsById = {};
  if (photo.isOwner) {
    const { albums } = await App.api('/api/albums');
    albums.forEach((a) => (albumsById[a.id] = a));
  }

  let current = 0; // index of the image being shown

  function show(index) {
    const count = photo.images.length;
    current = (index + count) % count;
    const image = photo.images[current];
    $('img').src = image.url;
    $('img').alt = `${photo.title} (${current + 1} of ${count})`;
    $('download').href = image.url + '?download=1';
    $('viewer-count').textContent = `${current + 1} / ${count}`;
    document.querySelectorAll('#thumbs .thumb').forEach((el, i) => el.classList.toggle('current', i === current));
  }

  function renderViewer() {
    const count = photo.images.length;
    const multi = count > 1;
    $('prev').classList.toggle('d-none', !multi);
    $('next').classList.toggle('d-none', !multi);
    $('viewer-count').classList.toggle('d-none', !multi);
    $('thumbs').classList.toggle('d-none', !multi);
    $('add-wrap').classList.toggle('d-none', !photo.isOwner || count >= MAX_IMAGES);

    // Only this post's own photos are listed here.
    $('thumbs').innerHTML = photo.images
      .map(
        (im, i) => `
        <div class="thumb">
          <button class="thumb-btn" data-index="${i}" aria-label="Show photo ${i + 1} of ${count}">
            <img src="${App.esc(im.url)}" alt="" loading="lazy">
          </button>
          ${photo.isOwner && multi ? `<button class="thumb-remove" data-remove="${i}" aria-label="Remove photo ${i + 1}"><i class="bi bi-x"></i></button>` : ''}
        </div>`
      )
      .join('');
    show(Math.min(current, count - 1));
  }

  function render() {
    document.title = photo.title + ' · SnapShare';
    $('badge').innerHTML = App.visBadge(photo.visibility)
      .replace('vis-badge', 'badge rounded-pill border')
      .replace('<span', '<span style="background: var(--soft); color: var(--ink)"');
    $('title').textContent = photo.title;
    $('owner-avatar').innerHTML = App.avatar(photo.owner.name, 40);
    $('owner-name').textContent = photo.owner.name;
    $('posted').textContent = App.timeAgo(photo.createdAt);
    $('description').textContent = photo.description;
    $('description').classList.toggle('d-none', !photo.description);
    $('tags').innerHTML = photo.tags.map((t) => App.tagChip(t)).join('');
    $('cat').innerHTML = `<span class="tag ${App.catClass(photo.category)}">${App.esc(photo.category)}</span>`;
    $('date').textContent = App.formatDate(photo.createdAt);
    $('album').textContent = photo.albumId && albumsById[photo.albumId] ? albumsById[photo.albumId].name : 'None';
    $('share').classList.toggle('d-none', photo.visibility !== 'public');
    $('owner-tools').classList.toggle('d-none', !photo.isOwner);
    $('toggle-vis').innerHTML =
      photo.visibility === 'public'
        ? '<i class="bi bi-lock"></i> Make private'
        : '<i class="bi bi-globe2"></i> Make public';
    renderLike();
    $('views').textContent = photo.views;
    $('comment-count').textContent = photo.commentCount;
    renderViewer();
  }

  function renderLike() {
    const btn = $('like');
    btn.classList.toggle('liked', photo.liked);
    btn.setAttribute('aria-pressed', String(photo.liked));
    btn.querySelector('i').className = 'bi ' + (photo.liked ? 'bi-heart-fill' : 'bi-heart');
    $('likes').textContent = photo.likeCount;
  }

  $('content').classList.remove('d-none');
  render();

  // ---- Browsing the post's photos ----
  $('prev').addEventListener('click', (e) => {
    e.stopPropagation();
    show(current - 1);
  });
  $('next').addEventListener('click', (e) => {
    e.stopPropagation();
    show(current + 1);
  });
  $('thumbs').addEventListener('click', async (e) => {
    const removeBtn = e.target.closest('[data-remove]');
    if (removeBtn) {
      const index = Number(removeBtn.dataset.remove);
      const ok = await App.confirm({
        title: 'Remove this photo?',
        message: 'It will be taken out of this post and deleted. The rest of the post stays.',
        confirmLabel: 'Remove',
      });
      if (!ok) return;
      try {
        photo = (await App.api(`/api/photos/${photo.id}/images/${index}`, { method: 'DELETE' })).photo;
        current = Math.max(0, Math.min(current, photo.images.length - 1));
        render();
        App.toast('Photo removed');
      } catch (err) {
        App.toast(err.message, 'danger');
      }
      return;
    }
    const thumb = e.target.closest('[data-index]');
    if (thumb) show(Number(thumb.dataset.index));
  });

  // ---- Full-screen viewer (also steps through this post's photos) ----
  function openLightbox() {
    const box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', photo.title);
    const multi = photo.images.length > 1;
    box.innerHTML = `
      <img alt="">
      <button class="close" aria-label="Close viewer"><i class="bi bi-x-lg"></i></button>
      ${multi ? '<button class="viewer-nav prev" aria-label="Previous photo"><i class="bi bi-chevron-left"></i></button><button class="viewer-nav next" aria-label="Next photo"><i class="bi bi-chevron-right"></i></button><span class="viewer-count"></span>' : ''}`;
    const img = box.querySelector('img');
    const paint = () => {
      img.src = photo.images[current].url;
      img.alt = `${photo.title} (${current + 1} of ${photo.images.length})`;
      const counter = box.querySelector('.viewer-count');
      if (counter) counter.textContent = `${current + 1} / ${photo.images.length}`;
      show(current);
    };
    const step = (delta) => {
      show(current + delta);
      paint();
    };
    const close = () => {
      box.remove();
      document.removeEventListener('keydown', onKey);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      if (multi && e.key === 'ArrowLeft') step(-1);
      if (multi && e.key === 'ArrowRight') step(1);
    };
    box.addEventListener('click', (e) => {
      if (e.target.closest('.close') || e.target === box) return close();
      if (e.target.closest('.prev')) return step(-1);
      if (e.target.closest('.next')) return step(1);
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(box);
    paint();
    box.querySelector('.close').focus();
  }
  $('viewer').addEventListener('click', openLightbox);

  // ---- Adding photos to the post ----
  $('add-btn').addEventListener('click', () => $('add-files').click());
  $('add-files').addEventListener('change', async (e) => {
    const picked = [...e.target.files];
    e.target.value = '';
    if (!picked.length) return;
    const room = MAX_IMAGES - photo.images.length;
    const valid = picked.filter((f) => TYPES.includes(f.type) && f.size <= MAX_SIZE);
    if (valid.length < picked.length) App.toast('Some files were skipped (JPEG, PNG, WebP or GIF up to 10 MB).', 'warning');
    const files = valid.slice(0, room);
    if (valid.length > room) App.toast(`Only ${room} more photo${room === 1 ? '' : 's'} fit in this post.`, 'warning');
    if (!files.length) return;

    const form = new FormData();
    files.forEach((f) => form.append('images', f));
    $('add-btn').disabled = true;
    try {
      const res = await fetch(`/api/photos/${photo.id}/images`, { method: 'POST', body: form, credentials: 'same-origin' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Upload failed. Try again.');
      photo = data.photo;
      current = photo.images.length - 1;
      render();
      App.toast(`${files.length} photo${files.length === 1 ? '' : 's'} added`);
    } catch (err) {
      App.toast(err.message, 'danger');
    } finally {
      $('add-btn').disabled = false;
    }
  });

  // ---- Likes and sharing ----
  $('like').addEventListener('click', async () => {
    if (!user) return (location.href = '/login.html?next=' + encodeURIComponent(location.pathname + location.search));
    try {
      const res = await App.api(`/api/photos/${photo.id}/like`, { method: 'POST' });
      photo.liked = res.liked;
      photo.likeCount = res.likeCount;
      renderLike();
    } catch (err) {
      App.toast(err.message, 'danger');
    }
  });

  $('share').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      App.toast('Link copied');
    } catch {
      App.toast('Copy failed. Copy the address bar instead.', 'warning');
    }
  });

  // ---- Owner tools ----
  $('toggle-vis').addEventListener('click', async () => {
    const next = photo.visibility === 'public' ? 'private' : 'public';
    try {
      photo = (await App.api('/api/photos/' + photo.id, { method: 'PATCH', body: { visibility: next } })).photo;
      render();
      App.toast(next === 'public' ? 'Post is now public' : 'Post is now private');
    } catch (err) {
      App.toast(err.message, 'danger');
    }
  });

  $('delete').addEventListener('click', async () => {
    const count = photo.images.length;
    const ok = await App.confirm({
      title: 'Delete this post?',
      message: `"${photo.title}"${count > 1 ? ` and its ${count} photos` : ''} will be removed permanently, along with its likes and comments.`,
    });
    if (!ok) return;
    try {
      await App.api('/api/photos/' + photo.id, { method: 'DELETE' });
      location.href = '/my-photos.html';
    } catch (err) {
      App.toast(err.message, 'danger');
    }
  });

  if (photo.isOwner) {
    const { categories } = await App.api('/api/meta');
    $('e-category').innerHTML = categories.map((c) => `<option>${App.esc(c)}</option>`).join('');
    $('e-album').insertAdjacentHTML(
      'beforeend',
      Object.values(albumsById).map((a) => `<option value="${App.esc(a.id)}">${App.esc(a.name)}</option>`).join('')
    );

    $('edit-modal').addEventListener('show.bs.modal', () => {
      $('e-title').value = photo.title;
      $('e-description').value = photo.description;
      $('e-tags').value = photo.tags.join(', ');
      $('e-category').value = photo.category;
      $('e-album').value = photo.albumId || '';
      $('edit-error').classList.add('d-none');
    });

    $('edit-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        photo = (
          await App.api('/api/photos/' + photo.id, {
            method: 'PATCH',
            body: {
              title: $('e-title').value,
              description: $('e-description').value,
              tags: $('e-tags').value,
              category: $('e-category').value,
              albumId: $('e-album').value,
            },
          })
        ).photo;
        bootstrap.Modal.getInstance($('edit-modal')).hide();
        render();
        App.toast('Changes saved');
      } catch (err) {
        $('edit-error').textContent = err.message;
        $('edit-error').classList.remove('d-none');
      }
    });
  }

  // ---- Comments ----
  async function loadComments() {
    const { comments } = await App.api(`/api/photos/${photo.id}/comments`);
    $('comment-total').textContent = comments.length;
    $('comment-count').textContent = comments.length;
    $('comments').innerHTML = comments
      .map(
        (c) => `
        <div class="comment">
          ${App.avatar(c.author.name, 34)}
          <div class="flex-grow-1" style="min-width:0">
            <div><span class="who">${App.esc(c.author.name)}</span><span class="when">${App.timeAgo(c.createdAt)}</span></div>
            <div class="text">${App.esc(c.text)}</div>
          </div>
          ${c.canDelete ? `<button class="icon-btn" data-del="${App.esc(c.id)}" aria-label="Delete comment" style="width:28px;height:28px"><i class="bi bi-trash"></i></button>` : ''}
        </div>`
      )
      .join('');
  }

  $('comment-hint').classList.toggle('d-none', Boolean(user));
  $('comment-form').classList.toggle('d-none', !user);

  $('comment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('comment-text');
    const text = input.value.trim();
    if (!text) return input.focus();
    try {
      await App.api(`/api/photos/${photo.id}/comments`, { method: 'POST', body: { text } });
      input.value = '';
      await loadComments();
    } catch (err) {
      App.toast(err.message, 'danger');
    }
  });

  $('comments').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-del]');
    if (!btn) return;
    try {
      await App.api(`/api/photos/${photo.id}/comments/${btn.dataset.del}`, { method: 'DELETE' });
      await loadComments();
    } catch (err) {
      App.toast(err.message, 'danger');
    }
  });

  loadComments().catch(() => {});
});
