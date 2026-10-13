// Shared helpers used by every page.
const App = (() => {
  let me = null;
  let meLoaded = false;

  async function api(url, { method = 'GET', body } = {}) {
    const opts = { method, headers: {}, credentials: 'same-origin' };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || 'Something went wrong. Try again.');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  async function currentUser() {
    if (!meLoaded) {
      try {
        me = (await api('/api/auth/me')).user;
      } catch {
        me = null;
      }
      meLoaded = true;
    }
    return me;
  }

  // Redirects to login when signed out. Returns the user otherwise.
  async function requireLogin() {
    const user = await currentUser();
    if (!user) {
      location.href = '/login.html?next=' + encodeURIComponent(location.pathname + location.search);
      return new Promise(() => {});
    }
    return user;
  }

  function esc(value) {
    const d = document.createElement('div');
    d.textContent = value == null ? '' : String(value);
    return d.innerHTML;
  }

  function toast(message, kind = 'dark') {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    const el = document.createElement('div');
    el.className = `alert alert-${kind} shadow-sm py-2 px-3 mb-0`;
    el.setAttribute('role', 'status');
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  // Initials on a soft color picked from the name, since users have no profile photos yet.
  const AVATAR_COLORS = [
    ['#dbe7ff', '#27468f'], ['#dcf5e7', '#1f6b45'], ['#ffe9d6', '#8a4b16'],
    ['#f3e1ff', '#6a34a1'], ['#ffe0e6', '#9a2f45'], ['#e0f4f7', '#1c6677'],
  ];
  function avatar(name, size = 32) {
    const text = String(name || '?').trim();
    const initials = text.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
    let hash = 0;
    for (const ch of text) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const [bg, fg] = AVATAR_COLORS[hash % AVATAR_COLORS.length];
    return `<span class="avatar" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px;background:${bg};color:${fg}" aria-hidden="true">${esc(initials)}</span>`;
  }

  function timeAgo(iso) {
    const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    const units = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];
    for (const [name, secs] of units) {
      if (s >= secs) {
        const n = Math.floor(s / secs);
        return `${n} ${name}${n === 1 ? '' : 's'} ago`;
      }
    }
    return 'just now';
  }

  function visBadge(v) {
    return v === 'private'
      ? '<span class="vis-badge"><i class="bi bi-lock"></i> Private</span>'
      : '<span class="vis-badge"><i class="bi bi-globe2"></i> Public</span>';
  }

  const catClass = (category) => 'cat-' + String(category || 'other').toLowerCase();

  // Stable color per tag so the same tag always looks the same.
  const TAG_COLORS = ['#5b4bf0', '#0ea5e9', '#16a34a', '#f97316', '#ec4899', '#0d9488', '#e11d48', '#7c3aed'];
  function tagChip(tag) {
    let hash = 0;
    for (const ch of String(tag)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return `<a class="tag" style="--c:${TAG_COLORS[hash % TAG_COLORS.length]}" href="/explore.html?q=${encodeURIComponent(tag)}">#${esc(tag)}</a>`;
  }

  function photoTile(p, { showBadge = false } = {}) {
    const href = '/photo.html?id=' + encodeURIComponent(p.id);
    return `
      <article class="photo-card ${catClass(p.category)}"${p.imageCount > 1 ? ` data-images="${esc(p.images.map((im) => im.url).join(' '))}"` : ''}>
        <div class="photo-media">
          <a class="photo-link" href="${href}" aria-label="${esc(p.title)}">
            <img src="${esc(p.url)}" alt="${esc(p.title)}" loading="lazy">
          </a>
          ${showBadge ? visBadge(p.visibility) : ''}
          <span class="cat-pill">${esc(p.category)}</span>
          ${p.imageCount > 1 ? `<span class="multi-badge" title="${p.imageCount} photos"><i class="bi bi-images"></i> ${p.imageCount}</span>` : ''}
          ${p.isOwner ? `<button class="card-delete" data-delete="${esc(p.id)}" aria-label="Delete ${esc(p.title)}" title="Delete post"><i class="bi bi-trash"></i></button>` : ''}
          <button class="card-like ${p.liked ? 'liked' : ''}" data-like="${esc(p.id)}" aria-pressed="${p.liked}" aria-label="Like ${esc(p.title)}">
            <i class="bi ${p.liked ? 'bi-heart-fill' : 'bi-heart'}"></i>
          </button>
        </div>
        <div class="photo-body">
          <div class="d-flex align-items-center gap-2">
            ${avatar(p.owner.name, 32)}
            <div style="min-width:0">
              <a class="photo-title" href="${href}">${esc(p.title)}</a>
              <div class="photo-owner">${esc(p.owner.name)}${p.sample ? ' <span class="sample-tag">Sample</span>' : ''}</div>
            </div>
          </div>
          <div class="photo-stats">
            <span class="likes ${p.liked ? 'liked' : ''}"><i class="bi ${p.liked ? 'bi-heart-fill' : 'bi-heart'}"></i> <b class="n">${p.likeCount}</b></span>
            <span><i class="bi bi-chat"></i> ${p.commentCount}</span>
          </div>
        </div>
      </article>`;
  }

  // Promise-based replacement for window.confirm, styled like the rest of the site.
  function confirmDialog({ title, message, confirmLabel = 'Delete' }) {
    return new Promise((resolve) => {
      const el = document.createElement('div');
      el.className = 'modal fade';
      el.tabIndex = -1;
      el.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-body p-4">
              <h2 class="fs-5 fw-semibold">${esc(title)}</h2>
              <p class="text-secondary mb-4">${esc(message)}</p>
              <div class="d-flex justify-content-end gap-2">
                <button class="btn btn-outline-navy" data-bs-dismiss="modal">Cancel</button>
                <button class="btn btn-danger" data-ok>${esc(confirmLabel)}</button>
              </div>
            </div>
          </div>
        </div>`;
      document.body.appendChild(el);
      const modal = new bootstrap.Modal(el);
      let result = false;
      el.querySelector('[data-ok]').addEventListener('click', () => {
        result = true;
        modal.hide();
      });
      el.addEventListener('hidden.bs.modal', () => {
        el.remove();
        resolve(result);
      });
      modal.show();
    });
  }

  // Delete from any card the signed-in user owns.
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-delete]');
    if (!btn) return;
    e.preventDefault();
    const card = btn.closest('.photo-card');
    const name = card.querySelector('.photo-title').textContent;
    const ok = await confirmDialog({
      title: 'Delete this post?',
      message: `"${name}" will be removed permanently, along with its likes and comments.`,
    });
    if (!ok) return;
    try {
      await api('/api/photos/' + btn.dataset.delete, { method: 'DELETE' });
      card.style.transition = 'opacity .25s, transform .25s';
      card.style.opacity = '0';
      card.style.transform = 'scale(.95)';
      setTimeout(() => {
        card.remove();
        document.dispatchEvent(new CustomEvent('photo-deleted'));
      }, 250);
      toast('Post deleted');
    } catch (err) {
      toast(err.message, 'danger');
    }
  });

  function skeletons(n = 8) {
    return Array.from({ length: n }, () => '<div class="skeleton" aria-hidden="true"></div>').join('');
  }

  // One handler for the heart on every card, including cards added later.
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-like]');
    if (!btn) return;
    e.preventDefault();
    const user = await currentUser();
    if (!user) {
      location.href = '/login.html?next=' + encodeURIComponent(location.pathname + location.search);
      return;
    }
    try {
      const res = await api(`/api/photos/${btn.dataset.like}/like`, { method: 'POST' });
      const card = btn.closest('.photo-card');
      const icon = res.liked ? 'bi-heart-fill' : 'bi-heart';
      btn.classList.toggle('liked', res.liked);
      btn.setAttribute('aria-pressed', String(res.liked));
      btn.querySelector('i').className = 'bi ' + icon;
      const likes = card.querySelector('.likes');
      likes.classList.toggle('liked', res.liked);
      likes.querySelector('i').className = 'bi ' + icon;
      likes.querySelector('.n').textContent = res.likeCount;
      btn.classList.remove('pop');
      void btn.offsetWidth;
      btn.classList.add('pop');
    } catch (err) {
      toast(err.message, 'danger');
    }
  });

  function formatSize(bytes) {
    return bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB';
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-bs-theme', theme);
    try {
      localStorage.setItem('snapshare-theme', theme);
    } catch {}
  }

  async function renderNav() {
    const el = document.getElementById('nav');
    if (!el) return;
    const user = await currentUser();
    const here = location.pathname === '/index.html' ? '/' : location.pathname;
    const link = (href, label) => `<a href="${href}" class="${here === href ? 'active' : ''}">${label}</a>`;
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    const q = new URLSearchParams(location.search).get('q') || '';

    const account = user
      ? `<a class="btn btn-navy btn-sm d-none d-sm-inline-flex align-items-center gap-1" href="/upload.html"><i class="bi bi-plus-lg"></i> Upload</a>
         <div class="dropdown">
           <button class="icon-btn" data-bs-toggle="dropdown" aria-label="Account menu" style="width:auto">${avatar(user.name, 34)}</button>
           <ul class="dropdown-menu dropdown-menu-end">
             <li class="px-3 py-2 small text-secondary">${esc(user.name)}</li>
             <li><a class="dropdown-item" href="/upload.html">Upload photo</a></li>
             <li><a class="dropdown-item" href="/my-photos.html">My photos</a></li>
             <li><a class="dropdown-item" href="/albums.html">Albums</a></li>
             <li><hr class="dropdown-divider"></li>
             <li><button class="dropdown-item" id="logout-btn">Log out</button></li>
           </ul>
         </div>`
      : `<a class="btn btn-outline-navy btn-sm" href="/login.html">Log in</a>
         <a class="btn btn-navy btn-sm" href="/register.html">Sign up</a>`;

    el.innerHTML = `
      <header class="site-nav">
        <div class="container inner">
          <a class="brand" href="/"><span class="brand-mark"><i class="bi bi-camera"></i></span>SnapShare</a>
          <nav class="nav-links" aria-label="Main">
            ${link('/', 'Home')}${link('/explore.html', 'Explore')}
            ${user ? link('/my-photos.html', 'My Photos') + link('/albums.html', 'Albums') : ''}
          </nav>
          <form class="nav-search" action="/explore.html" role="search">
            <i class="bi bi-search" aria-hidden="true"></i>
            <input type="search" name="q" value="${esc(q)}" placeholder="Search photos or tags" aria-label="Search photos or tags">
          </form>
          <button class="icon-btn" id="theme-btn" aria-label="Toggle dark mode"><i class="bi ${dark ? 'bi-sun' : 'bi-moon'}"></i></button>
          ${account}
        </div>
      </header>`;

    document.getElementById('theme-btn').addEventListener('click', (e) => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      setTheme(next);
      e.currentTarget.innerHTML = `<i class="bi ${next === 'dark' ? 'bi-sun' : 'bi-moon'}"></i>`;
    });
    const out = document.getElementById('logout-btn');
    if (out) {
      out.addEventListener('click', async () => {
        await api('/api/auth/logout', { method: 'POST' });
        location.href = '/';
      });
    }
  }

  function safeNext() {
    const next = new URLSearchParams(location.search).get('next');
    return next && next.startsWith('/') && !next.startsWith('//') ? next : '/my-photos.html';
  }

  document.addEventListener('DOMContentLoaded', renderNav);

  return {
    api, currentUser, requireLogin, confirm: confirmDialog, esc, toast, avatar, timeAgo, photoTile,
    tagChip, catClass, skeletons, visBadge, formatSize, formatDate, safeNext,
  };
})();
