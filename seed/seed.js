// Fills a running SnapShare with sample posts, likes and comments.
//
//   npm start          (in one terminal)
//   npm run seed       (in another)
//
// It talks to the real HTTP API, so every rule (validation, ownership,
// visibility) applies exactly as it would for a person using the site.
// Safe to run more than once: posts with the same title are skipped.

const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
const IMAGES = path.join(__dirname, 'images');

const { PASSWORD, USERS, POSTS, COMMENTS } = require('./content');

function client() {
  let cookie = '';
  return async function request(url, { method = 'GET', json, form } = {}) {
    const headers = cookie ? { cookie } : {};
    let body;
    if (json) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(json);
    } else if (form) {
      body = form;
    }
    const res = await fetch(BASE + url, { method, headers, body });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  };
}

async function signIn(user) {
  const api = client();
  let res = await api('/api/auth/login', { method: 'POST', json: { email: user.email, password: PASSWORD } });
  if (res.status !== 200) {
    res = await api('/api/auth/register', { method: 'POST', json: { name: user.name, email: user.email, password: PASSWORD } });
  }
  if (res.status !== 200 && res.status !== 201) throw new Error(`Could not sign in ${user.name}: ${res.data.error}`);
  return api;
}

(async () => {
  try {
    await fetch(BASE + '/api/meta');
  } catch {
    console.error(`Cannot reach ${BASE}. Start the site first with: npm start`);
    process.exit(1);
  }

  const apis = {};
  for (const u of USERS) apis[u.key] = await signIn(u);

  // Look a post up by title among the demo accounts only.
  async function findPost(title) {
    for (const key of Object.keys(apis)) {
      const mine = (await apis[key]('/api/photos/mine?limit=60')).data.items || [];
      const post = mine.find((p) => p.title === title);
      if (post) return { api: apis[key], post };
    }
    return null;
  }

  // 1. Retire older single-photo demo posts that the new multi-photo posts replace.
  let retired = 0;
  for (const post of POSTS) {
    if (await findPost(post.title)) continue; // already seeded, nothing to replace
    for (const oldTitle of post.replaces || []) {
      const found = await findPost(oldTitle);
      if (found && (await found.api(`/api/photos/${found.post.id}`, { method: 'DELETE' })).status === 200) retired += 1;
    }
  }

  // 2. Create posts.
  const ids = {};
  let added = 0;
  for (const p of POSTS) {
    const existing = await findPost(p.title);
    if (existing) {
      ids[p.title] = existing.post.id;
      continue;
    }
    const form = new FormData();
    form.append('title', p.title);
    form.append('description', p.description);
    form.append('category', p.category);
    form.append('tags', p.tags);
    form.append('visibility', 'public');
    for (const file of p.files) {
      const bytes = fs.readFileSync(path.join(IMAGES, file));
      form.append('images', new Blob([bytes], { type: 'image/jpeg' }), file);
    }
    const res = await apis[p.by]('/api/photos', { method: 'POST', form });
    if (res.status !== 201) throw new Error(`Upload failed for "${p.title}": ${res.data.error}`);
    ids[p.title] = res.data.photo.id;
    added += 1;
  }

  // 3. Each person likes most of the other person's posts, so the numbers look natural.
  let likes = 0;
  for (const [i, p] of POSTS.entries()) {
    if (i % 4 === 3) continue;
    const liker = p.by === 'arjun' ? 'priya' : 'arjun';
    const post = (await apis[liker](`/api/photos/${ids[p.title]}`)).data.photo;
    if (post.liked) continue;
    await apis[liker](`/api/photos/${ids[p.title]}/like`, { method: 'POST' });
    likes += 1;
  }

  // 4. A few comments.
  let comments = 0;
  for (const [who, title, text] of COMMENTS) {
    const list = (await apis[who](`/api/photos/${ids[title]}/comments`)).data.comments || [];
    if (list.some((c) => c.text === text)) continue;
    await apis[who](`/api/photos/${ids[title]}/comments`, { method: 'POST', json: { text } });
    comments += 1;
  }

  console.log(
    `Seeded ${added} posts (${retired} older single-photo posts replaced), ${likes} likes and ${comments} comments.`
  );
})().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
