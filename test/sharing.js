// Two people, two accounts: what one posts publicly, the other sees.
// Also checks that a fresh site fills itself with demo posts exactly once.
// Run with: npm test (uses a throwaway data folder).

const os = require('os');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'snapshare-sharing-'));
process.env.DATA_FILE = path.join(tmp, 'db.json');
process.env.UPLOAD_DIR = path.join(tmp, 'uploads');
process.env.JWT_SECRET = 'test-secret';
process.env.STARTER_CONTENT = 'off';

const app = require('../server');
const db = require('../src/store');
const { ensureDemoContent } = require('../src/lib/demo');

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log('  ok  ' + name);
}

(async () => {
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;

  function client() {
    let cookie = '';
    return async (url, { method = 'GET', json, form } = {}) => {
      const headers = cookie ? { cookie } : {};
      let body;
      if (json) {
        headers['content-type'] = 'application/json';
        body = JSON.stringify(json);
      } else if (form) {
        body = form;
      }
      const res = await fetch(base + url, { method, headers, body });
      const set = res.headers.get('set-cookie');
      if (set) cookie = set.split(';')[0];
      const type = res.headers.get('content-type') || '';
      return { status: res.status, body: type.includes('json') ? await res.json() : null };
    };
  }

  const post = (api, title, visibility) => {
    const f = new FormData();
    f.append('title', title);
    f.append('category', 'Travel');
    f.append('visibility', visibility);
    f.append('images', new Blob([PNG], { type: 'image/png' }), 'a.png');
    f.append('images', new Blob([PNG], { type: 'image/png' }), 'b.png');
    return api('/api/photos', { method: 'POST', form: f });
  };

  try {
    console.log('SnapShare sharing checks');

    await check('a fresh site fills itself with demo posts, exactly once', async () => {
      process.env.DEMO_CONTENT = 'on';
      assert.strictEqual(ensureDemoContent(), 14);
      assert.strictEqual(ensureDemoContent(), 0);
      const anon = client();
      const list = await anon('/api/photos?limit=60');
      assert.strictEqual(list.body.total, 14);
      const stats = await anon('/api/stats');
      assert.strictEqual(stats.body.creators, 2);
      assert.ok(stats.body.likes > 0);
      // demo images are real and served
      assert.strictEqual((await fetch(base + list.body.items[0].url)).status, 200);
      // demo accounts can log in
      const demo = client();
      const login = await demo('/api/auth/login', { method: 'POST', json: { email: 'arjun@snapshare.demo', password: 'snapshare-demo-1' } });
      assert.strictEqual(login.status, 200);
      process.env.DEMO_CONTENT = 'off';
    });

    const first = client();
    const second = client();
    await first('/api/auth/register', { method: 'POST', json: { name: 'First Person', email: 'first@example.com', password: 'password123' } });
    await second('/api/auth/register', { method: 'POST', json: { name: 'Second Person', email: 'second@example.com', password: 'password123' } });

    let shared;
    await check("a second account sees the first account's public post", async () => {
      const made = await post(first, 'Goa trip', 'public');
      assert.strictEqual(made.status, 201);
      shared = made.body.photo;

      const explore = await second('/api/photos?limit=60');
      const found = explore.body.items.find((p) => p.id === shared.id);
      assert.ok(found, 'post should be on Explore for the second account');
      assert.strictEqual(found.owner.name, 'First Person');

      const open = await second(`/api/photos/${shared.id}`);
      assert.strictEqual(open.status, 200);
      for (const img of open.body.photo.images) {
        assert.strictEqual((await fetch(base + img.url)).status, 200);
      }
      assert.strictEqual((await second('/api/photos?q=goa')).body.total, 1);
    });

    await check('the second account can like and comment on it', async () => {
      const like = await second(`/api/photos/${shared.id}/like`, { method: 'POST' });
      assert.strictEqual(like.body.liked, true);
      const comment = await second(`/api/photos/${shared.id}/comments`, { method: 'POST', json: { text: 'Looks amazing!' } });
      assert.strictEqual(comment.status, 201);
      const seenByOwner = await first(`/api/photos/${shared.id}/comments`);
      assert.strictEqual(seenByOwner.body.comments[0].author.name, 'Second Person');
    });

    await check('a private post stays hidden from the second account', async () => {
      const hidden = (await post(first, 'Private diary', 'private')).body.photo;
      assert.strictEqual((await second(`/api/photos/${hidden.id}`)).status, 404);
      assert.ok(!(await second('/api/photos?limit=60')).body.items.some((p) => p.id === hidden.id));
      assert.strictEqual((await first(`/api/photos/${hidden.id}`)).status, 200);
    });

    await check('the demo content is not re-added once real posts exist', async () => {
      process.env.DEMO_CONTENT = 'on';
      const before = db.photos.find().length;
      assert.strictEqual(ensureDemoContent(), 0);
      assert.strictEqual(db.photos.find().length, before);
      process.env.DEMO_CONTENT = 'off';
    });

    console.log(`\n${passed} checks passed`);
  } catch (err) {
    console.error('\nFAILED:', err.message);
    process.exitCode = 1;
  } finally {
    server.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})();
