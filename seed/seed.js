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

// Sample accounts. These are for local demos only; delete them from your data when you are done.
const PASSWORD = 'snapshare-demo-1';
const USERS = [
  { key: 'arjun', name: 'Arjun Mehta', email: 'arjun@snapshare.demo' },
  { key: 'priya', name: 'Priya Sharma', email: 'priya@snapshare.demo' },
];

// One entry is one post. `files` are its photos, the first is the cover.
// `replaces` lists older single-photo demo posts that this post supersedes;
// they are removed first so the same picture is not shown twice.
const POSTS = [
  { by: 'arjun', title: 'Himalayan Peaks', category: 'Travel', tags: 'travel, mountains, snow', files: ['photo-29.jpg'],
    description: 'Fresh snow on the ridgeline after a cold, clear morning. The valley below was still in shadow.' },
  { by: 'arjun', title: 'Waterfall Hike', category: 'Nature', tags: 'nature, waterfall, hiking', files: ['photo-15.jpg', 'photo-28.jpg', 'photo-10.jpg'],
    replaces: ['Hidden Waterfall', 'Green Gorge', 'Forest Above the Bay'],
    description: 'A full day on the trail: the falls, the green gorge below them and the view back over the bay.' },
  { by: 'arjun', title: 'Trail Days', category: 'People', tags: 'people, hiking, sunset', files: ['photo-177.jpg', 'photo-173.jpg'],
    replaces: ['Trail Day', 'Sunset Silhouette'],
    description: 'Pausing on the ridge, then one figure and a lot of sky as the light went.' },
  { by: 'arjun', title: 'Workspace Setups', category: 'Technology', tags: 'tech, workspace, laptop', files: ['photo-48.jpg', 'photo-180.jpg', 'photo-201.jpg', 'photo-119.jpg'],
    replaces: ['Work From Anywhere', 'Desk Setup', 'Clean Workspace', 'Gadgets on White'],
    description: 'Four desks, four moods. Laptop, notebook and a plan for the week.' },
  { by: 'arjun', title: 'Vintage Car Meet', category: 'Events', tags: 'events, cars, vintage', files: ['photo-133.jpg', 'photo-111.jpg', 'photo-183.jpg'],
    replaces: ['Classic Car Meet', 'Show Car', 'Campervan Gathering'],
    description: 'The weekend meet: polished chrome, a very patient owner and a campervan with a story.' },
  { by: 'arjun', title: 'Old Stone', category: 'Architecture', tags: 'architecture, heritage, travel', files: ['photo-142.jpg', 'photo-193.jpg'],
    replaces: ['Chateau at the End of the Road', 'College Lawn'],
    description: 'A chateau at the end of the drive and a college lawn with four hundred years of stonework.' },
  { by: 'arjun', title: 'Time', category: 'Other', tags: 'monochrome, clock, abstract', files: ['photo-175.jpg'],
    description: 'A black and white study of a station clock.' },

  { by: 'priya', title: 'Pet Diaries', category: 'Animals', tags: 'pets, dog, cat', files: ['photo-237.jpg', 'photo-1025.jpg', 'photo-40.jpg'],
    replaces: ['Puppy Eyes', 'Cozy Pug', 'Whiskers Up Close'],
    description: 'A puppy who knows exactly how to get a treat, a pug in a blanket and a very sleepy cat.' },
  { by: 'priya', title: 'Cafe Mornings', category: 'Food', tags: 'food, coffee, cafe', files: ['photo-42.jpg', 'photo-113.jpg', 'photo-102.jpg'],
    replaces: ['Morning Coffee', 'Warm Cup', 'Fresh Raspberries'],
    description: 'Espresso before the rush, something warm in a cup, and raspberries that did not last the afternoon.' },
  { by: 'priya', title: 'Steel and Concrete', category: 'Architecture', tags: 'architecture, bridge, city', files: ['photo-134.jpg', 'photo-101.jpg'],
    replaces: ['Iron Arches', 'Concrete and Sky'],
    description: 'Looking straight up at old ironwork, then hard lines against a soft sky.' },
  { by: 'priya', title: 'Golden Hour Portraits', category: 'People', tags: 'people, portrait, sunset', files: ['photo-64.jpg', 'photo-129.jpg'],
    replaces: ['Golden Hour Portrait', 'Two on a Bench'],
    description: 'Wildflowers and warm light, then the best seat on the beach.' },
  { by: 'priya', title: 'Coastal Escape', category: 'Travel', tags: 'travel, beach, trail', files: ['photo-12.jpg', 'photo-17.jpg'],
    replaces: ['Quiet Shoreline', 'Path to the Coast'],
    description: 'Low tide and soft light, then the orchard trail that led straight to the sea.' },
  { by: 'priya', title: 'Weathered Planks', category: 'Other', tags: 'texture, wood, abstract', files: ['photo-143.jpg'],
    description: 'Old boards, peeling paint and a lot of character.' },
  { by: 'priya', title: 'Tunnel of Light', category: 'Other', tags: 'abstract, light, tunnel', files: ['photo-137.jpg'],
    description: 'Looking up a shaft to a pinpoint of daylight.' },
];

const COMMENTS = [
  ['priya', 'Himalayan Peaks', 'Absolutely stunning. The light on the ridge is perfect.'],
  ['arjun', 'Himalayan Peaks', 'Thank you! Took this one just after sunrise.'],
  ['arjun', 'Pet Diaries', 'The pug in the blanket is the best photo on the site.'],
  ['priya', 'Waterfall Hike', 'Where is this? I want to go.'],
  ['arjun', 'Cafe Mornings', 'Now I want a coffee.'],
  ['priya', 'Vintage Car Meet', 'That chrome is unreal.'],
];

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
