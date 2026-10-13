// Placeholder landscape used behind the hero until a public photo exists.
const FALLBACK_HERO = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 600" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1b2a5e"/><stop offset=".55" stop-color="#d9805f"/><stop offset="1" stop-color="#f4c28a"/>
    </linearGradient>
    <linearGradient id="lake" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e7a97a"/><stop offset="1" stop-color="#2a3566"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="600" fill="url(#sky)"/>
  <circle cx="1100" cy="330" r="64" fill="#fbe3b5" opacity=".9"/>
  <path d="M0 400 L180 250 L300 340 L470 190 L650 350 L800 270 L980 380 L1180 240 L1380 360 L1600 280 V470 H0Z" fill="#46507f"/>
  <path d="M0 450 L220 320 L380 420 L560 300 L760 430 L960 330 L1160 440 L1380 320 L1600 430 V500 H0Z" fill="#2a3566"/>
  <rect y="470" width="1600" height="130" fill="url(#lake)"/>
  <path d="M0 520 L140 440 L260 520 L420 430 L560 520 L720 450 L900 520 L1100 440 L1260 520 L1440 450 L1600 520 V600 H0Z" fill="#141c3f"/>
</svg>`;

document.addEventListener('DOMContentLoaded', async () => {
  const hero = document.getElementById('hero');
  hero.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(FALLBACK_HERO)}")`;

  const featuredEl = document.getElementById('featured');
  featuredEl.innerHTML = App.skeletons(8);

  const [{ categories }, featured, trending, stats] = await Promise.all([
    App.api('/api/meta'),
    App.api('/api/photos?sort=liked&limit=8'),
    App.api('/api/photos/tags/trending'),
    App.api('/api/stats'),
  ]);

  if (stats.photos) {
    document.getElementById('st-photos').textContent = stats.photos.toLocaleString();
    document.getElementById('st-creators').textContent = stats.creators.toLocaleString();
    document.getElementById('st-likes').textContent = stats.likes.toLocaleString();
    document.getElementById('hero-stats').classList.remove('d-none');
  }

  document.getElementById('categories').innerHTML =
    '<a class="chip all on" href="/explore.html">All</a>' +
    categories
      .filter((c) => c !== 'Other')
      .map((c) => `<a class="chip ${App.catClass(c)}" href="/explore.html?category=${encodeURIComponent(c)}">${App.esc(c)}</a>`)
      .join('');

  if (featured.items.length) {
    featuredEl.innerHTML = featured.items.map((p) => App.photoTile(p)).join('');
    // The most liked public photo doubles as the hero backdrop.
    const url = featured.items[0].url;
    const probe = new Image();
    probe.onload = () => {
      hero.style.backgroundImage = `url("${url}")`;
    };
    probe.src = url;
  } else {
    featuredEl.innerHTML = '';
    document.getElementById('empty').classList.remove('d-none');
  }

  if (trending.tags.length) {
    document.getElementById('trending').innerHTML = trending.tags
      .map((t) => App.tagChip(t.tag))
      .join('');
    document.getElementById('trending-wrap').classList.remove('d-none');
  }
});
