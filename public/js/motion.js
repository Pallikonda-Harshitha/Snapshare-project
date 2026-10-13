// Motion layer: scroll reveals, card tilt, hover slideshows, hero effects.
// Everything here is decoration. The site works without it, and it stays
// off entirely for people who ask their system for reduced motion.
(() => {
  const reduce = document.documentElement.getAttribute('data-motion') === 'reduced';
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // ---- Navigation shadow and scroll progress ----
  const bar = document.createElement('div');
  bar.className = 'scroll-progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(window.scrollY / max, 1) : 0})`;
      const nav = document.querySelector('.site-nav');
      if (nav) nav.classList.toggle('scrolled', window.scrollY > 8);
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---- Scroll reveal ----
  const REVEAL = '.photo-card, .album-card, .section-head, .panel, .photo-view, .thumbs, .empty';
  let io = null;
  if (!reduce && 'IntersectionObserver' in window) {
    io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target;
          io.unobserve(el);
          el.classList.add('in');
          // Hand the element back to its normal styles once the entrance is done.
          const wait = 900 + (parseInt(el.style.getPropertyValue('--d'), 10) || 0);
          setTimeout(() => el.classList.remove('reveal', 'in'), wait);
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -30px 0px' }
    );
  }

  function prepare(el) {
    if (!io || el.dataset.rv) return;
    el.dataset.rv = '1';
    const siblings = el.parentElement ? [...el.parentElement.children] : [];
    const index = Math.max(0, siblings.indexOf(el));
    el.style.setProperty('--d', Math.min(index, 8) * 70 + 'ms');
    el.classList.add('reveal');
    io.observe(el);
  }

  function scan(root) {
    if (root.matches && root.matches(REVEAL)) prepare(root);
    if (root.querySelectorAll) root.querySelectorAll(REVEAL).forEach(prepare);
  }

  if (io) {
    new MutationObserver((mutations) => {
      for (const m of mutations) m.addedNodes.forEach((n) => n.nodeType === 1 && scan(n));
    }).observe(document.body, { childList: true, subtree: true });
    scan(document.body);
  }

  // ---- Card tilt with a moving highlight ----
  if (!reduce && fine) {
    let active = null;
    const reset = (card) => {
      card.classList.remove('tilting');
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    };
    document.addEventListener('pointermove', (e) => {
      const card = e.target.closest && e.target.closest('.photo-card');
      if (active && active !== card) reset(active);
      active = card || null;
      if (!card) return;
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      card.classList.add('tilting');
      card.style.setProperty('--ry', ((x - 0.5) * 9).toFixed(2) + 'deg');
      card.style.setProperty('--rx', ((0.5 - y) * 7).toFixed(2) + 'deg');
      card.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
      card.style.setProperty('--my', (y * 100).toFixed(1) + '%');
    });
    document.addEventListener('pointerout', (e) => {
      if (!e.relatedTarget && active) {
        reset(active);
        active = null;
      }
    });
  }

  // ---- Posts with several photos flip through them on hover ----
  if (!reduce && fine) {
    const timers = new WeakMap();

    const start = (card) => {
      const urls = (card.dataset.images || '').split(' ').filter(Boolean);
      if (urls.length < 2 || timers.has(card)) return;
      const link = card.querySelector('.photo-link');
      const media = card.querySelector('.photo-media');
      if (!link || !media) return;

      let slides = [...link.querySelectorAll('.slide')];
      if (!slides.length) {
        slides = urls.slice(1).map((url) => {
          const img = new Image();
          img.className = 'slide';
          img.alt = '';
          img.src = url;
          link.appendChild(img);
          return img;
        });
      }
      let dots = media.querySelector('.slide-dots');
      if (!dots) {
        dots = document.createElement('div');
        dots.className = 'slide-dots';
        dots.innerHTML = urls.map(() => '<i></i>').join('');
        media.appendChild(dots);
      }

      let current = 0;
      const paint = () => {
        slides.forEach((img, i) => img.classList.toggle('on', i === current - 1));
        [...dots.children].forEach((d, i) => d.classList.toggle('on', i === current));
      };
      paint();
      const id = setInterval(() => {
        current = (current + 1) % urls.length;
        paint();
      }, 1100);
      timers.set(card, { id, slides, dots });
    };

    const stop = (card) => {
      const t = timers.get(card);
      if (!t) return;
      clearInterval(t.id);
      t.slides.forEach((img) => img.classList.remove('on'));
      t.dots.remove();
      timers.delete(card);
    };

    document.addEventListener('pointerover', (e) => {
      const card = e.target.closest && e.target.closest('.photo-card[data-images]');
      if (card && !card.contains(e.relatedTarget)) start(card);
    });
    document.addEventListener('pointerout', (e) => {
      const card = e.target.closest && e.target.closest('.photo-card[data-images]');
      if (card && !card.contains(e.relatedTarget)) stop(card);
    });
  }

  // ---- Heart burst when something becomes liked ----
  function burst(button) {
    const r = button.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const colors = ['#ec4899', '#f43f5e', '#f59e0b', '#a855f7', '#5b4bf0'];
    for (let i = 0; i < 10; i += 1) {
      const p = document.createElement('i');
      p.className = 'bi bi-heart-fill burst';
      p.style.left = cx + 'px';
      p.style.top = cy + 'px';
      p.style.color = colors[i % colors.length];
      document.body.appendChild(p);
      const angle = (Math.PI * 2 * i) / 10 + Math.random() * 0.4;
      const dist = 38 + Math.random() * 30;
      const anim = p.animate(
        [
          { transform: 'translate(-50%, -50%) scale(.4)', opacity: 1 },
          { transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist - 12}px)) scale(1)`, opacity: 0 },
        ],
        { duration: 650 + Math.random() * 250, easing: 'cubic-bezier(.2,.8,.2,1)' }
      );
      anim.onfinish = () => p.remove();
    }
  }
  if (!reduce) {
    document.addEventListener('click', (e) => {
      const button = e.target.closest('[data-like], #like');
      if (!button) return;
      // The like request is async; only celebrate once it actually became liked.
      setTimeout(() => button.classList.contains('liked') && burst(button), 380);
    });
  }

  // ---- Home page hero ----
  const hero = document.getElementById('hero');
  if (hero && !reduce) {
    ['o1', 'o2', 'o3'].forEach((name) => {
      const orb = document.createElement('div');
      orb.className = 'orb ' + name;
      orb.setAttribute('aria-hidden', 'true');
      hero.appendChild(orb);
    });
    if (fine) {
      hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        hero.style.setProperty('--px', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
        hero.style.setProperty('--py', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
      });
    }
  }

  // Count the hero numbers up when they appear.
  const stats = document.getElementById('hero-stats');
  if (stats && !reduce) {
    const run = () => {
      stats.querySelectorAll('b').forEach((el) => {
        const end = Number(el.textContent.replace(/[^0-9]/g, '')) || 0;
        const t0 = performance.now();
        const tick = (now) => {
          const p = Math.min((now - t0) / 1100, 1);
          el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))).toLocaleString();
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    };
    const watcher = new MutationObserver(() => {
      if (!stats.classList.contains('d-none')) {
        watcher.disconnect();
        run();
      }
    });
    watcher.observe(stats, { attributes: true, attributeFilter: ['class'] });
  }

  // ---- Photo page: crossfade when the shown photo changes ----
  const img = document.getElementById('img');
  if (img && document.getElementById('viewer') && !reduce) {
    new MutationObserver(() => {
      img.classList.remove('swap');
      void img.offsetWidth;
      img.classList.add('swap');
    }).observe(img, { attributes: true, attributeFilter: ['src'] });
  }
})();
