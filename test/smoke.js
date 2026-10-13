// End-to-end checks for the access rules. Run with: npm test
// Uses a throwaway data file and upload folder, so real data is never touched.
const os = require('os');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'snapshare-'));
process.env.DATA_FILE = path.join(tmp, 'db.json');
process.env.UPLOAD_DIR = path.join(tmp, 'uploads');
process.env.JWT_SECRET = 'test-secret';
process.env.STARTER_CONTENT = 'off';

const app = require('../server');

// Smallest valid PNG (1x1 pixel).
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

  // Tiny client that keeps its own cookie, so we can act as different users.
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
      return { status: res.status, body: type.includes('json') ? await res.json() : await res.arrayBuffer() };
    };
  }

  function photoForm({ visibility, title = 'Test photo', bytes = PNG, mime = 'image/png', albumId = '' }) {
    const f = new FormData();
    f.append('title', title);
    f.append('visibility', visibility);
    f.append('category', 'Nature');
    f.append('tags', 'Sunset, beach');
    if (albumId) f.append('albumId', albumId);
    f.append('image', new Blob([bytes], { type: mime }), 'x.png');
    return f;
  }

  const alice = client();
  const bob = client();
  const anon = client();

  try {
    console.log('SnapShare smoke test');

    await check('registers and logs in', async () => {
      const a = await alice('/api/auth/register', { method: 'POST', json: { name: 'Alice', email: 'alice@example.com', password: 'password123' } });
      assert.strictEqual(a.status, 201);
      const b = await bob('/api/auth/register', { method: 'POST', json: { name: 'Bob', email: 'bob@example.com', password: 'password123' } });
      assert.strictEqual(b.status, 201);
      const dup = await anon('/api/auth/register', { method: 'POST', json: { name: 'Alice 2', email: 'ALICE@example.com', password: 'password123' } });
      assert.strictEqual(dup.status, 409);
      const bad = await anon('/api/auth/login', { method: 'POST', json: { email: 'alice@example.com', password: 'wrongpass' } });
      assert.strictEqual(bad.status, 401);
    });

    let pub;
    let priv;
    await check('user can upload public and private photos', async () => {
      const r1 = await alice('/api/photos', { method: 'POST', form: photoForm({ visibility: 'public', title: 'Public one' }) });
      assert.strictEqual(r1.status, 201);
      pub = r1.body.photo;
      const r2 = await alice('/api/photos', { method: 'POST', form: photoForm({ visibility: 'private', title: 'Private one' }) });
      assert.strictEqual(r2.status, 201);
      priv = r2.body.photo;
      assert.deepStrictEqual(pub.tags, ['sunset', 'beach']);
    });

    await check('public photo is visible to visitors; private is not', async () => {
      assert.strictEqual((await anon(pub.url)).status, 200);
      assert.strictEqual((await anon('/api/photos/' + pub.id)).status, 200);
      assert.strictEqual((await anon(priv.url)).status, 404);
      assert.strictEqual((await anon('/api/photos/' + priv.id)).status, 404);
      assert.strictEqual((await bob(priv.url)).status, 404);
    });

    await check('owner can view their private photo', async () => {
      assert.strictEqual((await alice(priv.url)).status, 200);
    });

    await check('explore and search only list public photos', async () => {
      const list = await anon('/api/photos');
      assert.strictEqual(list.body.total, 1);
      assert.strictEqual(list.body.items[0].id, pub.id);
      const search = await anon('/api/photos?q=private');
      assert.strictEqual(search.body.total, 0);
      const mine = await alice('/api/photos/mine');
      assert.strictEqual(mine.body.total, 2);
      assert.strictEqual((await anon('/api/photos/mine')).status, 401);
    });

    await check("users cannot edit or delete someone else's photo", async () => {
      assert.strictEqual((await bob('/api/photos/' + pub.id, { method: 'PATCH', json: { title: 'Hacked' } })).status, 404);
      assert.strictEqual((await bob('/api/photos/' + pub.id, { method: 'DELETE' })).status, 404);
      assert.strictEqual((await anon('/api/photos/' + pub.id, { method: 'DELETE' })).status, 401);
    });

    await check('switching visibility takes effect immediately', async () => {
      await alice('/api/photos/' + priv.id, { method: 'PATCH', json: { visibility: 'public' } });
      assert.strictEqual((await anon(priv.url)).status, 200);
      await alice('/api/photos/' + priv.id, { method: 'PATCH', json: { visibility: 'private' } });
      assert.strictEqual((await anon(priv.url)).status, 404);
    });

    await check('invalid and disguised files are rejected', async () => {
      const text = await alice('/api/photos', { method: 'POST', form: photoForm({ visibility: 'public', bytes: Buffer.from('not an image'), mime: 'text/plain' }) });
      assert.strictEqual(text.status, 400);
      const fake = await alice('/api/photos', { method: 'POST', form: photoForm({ visibility: 'public', bytes: Buffer.from('<script>alert(1)</script>'), mime: 'image/png' }) });
      assert.strictEqual(fake.status, 400);
      const big = await alice('/api/photos', { method: 'POST', form: photoForm({ visibility: 'public', bytes: Buffer.concat([PNG, Buffer.alloc(11 * 1024 * 1024)]) }) });
      assert.strictEqual(big.status, 413);
      const noTitle = await alice('/api/photos', { method: 'POST', form: photoForm({ visibility: 'public', title: '' }) });
      assert.strictEqual(noTitle.status, 400);
    });

    await check('albums respect visibility', async () => {
      const created = await alice('/api/albums', { method: 'POST', json: { name: 'Trip', visibility: 'private' } });
      assert.strictEqual(created.status, 201);
      const album = created.body.album;
      await alice('/api/photos/' + pub.id, { method: 'PATCH', json: { albumId: album.id } });

      assert.strictEqual((await anon('/api/albums/' + album.id)).status, 404);
      await alice('/api/albums/' + album.id, { method: 'PATCH', json: { visibility: 'public' } });
      const view = await anon('/api/albums/' + album.id);
      assert.strictEqual(view.status, 200);
      assert.strictEqual(view.body.photos.length, 1);

      // A private photo inside a public album stays hidden from visitors.
      await alice('/api/photos/' + priv.id, { method: 'PATCH', json: { albumId: album.id } });
      const again = await anon('/api/albums/' + album.id);
      assert.strictEqual(again.body.photos.length, 1);
      assert.strictEqual((await alice('/api/albums/' + album.id)).body.photos.length, 2);

      // Cannot file a photo into someone else's album.
      const bobPhoto = await bob('/api/photos', { method: 'POST', form: photoForm({ visibility: 'private', albumId: album.id }) });
      assert.strictEqual(bobPhoto.status, 400);
    });

    await check('likes toggle and respect visibility', async () => {
      assert.strictEqual((await anon('/api/photos/' + pub.id + '/like', { method: 'POST' })).status, 401);
      const on = await bob('/api/photos/' + pub.id + '/like', { method: 'POST' });
      assert.deepStrictEqual(on.body, { liked: true, likeCount: 1 });
      const off = await bob('/api/photos/' + pub.id + '/like', { method: 'POST' });
      assert.deepStrictEqual(off.body, { liked: false, likeCount: 0 });
      await bob('/api/photos/' + pub.id + '/like', { method: 'POST' });
      assert.strictEqual((await bob('/api/photos/' + priv.id + '/like', { method: 'POST' })).status, 404);
      const sorted = await anon('/api/photos?sort=liked');
      assert.strictEqual(sorted.body.items[0].id, pub.id);
      assert.strictEqual(sorted.body.items[0].likeCount, 1);
    });

    await check('comments: add, list, and delete permissions', async () => {
      assert.strictEqual((await anon('/api/photos/' + pub.id + '/comments', { method: 'POST', json: { text: 'hi' } })).status, 401);
      assert.strictEqual((await bob('/api/photos/' + pub.id + '/comments', { method: 'POST', json: { text: '   ' } })).status, 400);
      const made = await bob('/api/photos/' + pub.id + '/comments', { method: 'POST', json: { text: 'Lovely shot' } });
      assert.strictEqual(made.status, 201);
      const cid = made.body.comment.id;
      assert.strictEqual((await bob('/api/photos/' + priv.id + '/comments', { method: 'POST', json: { text: 'peek' } })).status, 404);
      assert.strictEqual((await anon('/api/photos/' + priv.id + '/comments')).status, 404);

      const listed = await anon('/api/photos/' + pub.id + '/comments');
      assert.strictEqual(listed.body.comments.length, 1);
      assert.strictEqual(listed.body.comments[0].canDelete, false);

      const carol = client();
      await carol('/api/auth/register', { method: 'POST', json: { name: 'Carol', email: 'carol@example.com', password: 'password123' } });
      assert.strictEqual((await carol('/api/photos/' + pub.id + '/comments/' + cid, { method: 'DELETE' })).status, 403);
      // The photo's owner may remove comments on their own photo.
      assert.strictEqual((await alice('/api/photos/' + pub.id + '/comments/' + cid, { method: 'DELETE' })).status, 200);
      assert.strictEqual((await anon('/api/photos/' + pub.id)).body.photo.commentCount, 0);
    });

    await check('views count visitors but not the owner; trending tags are public only', async () => {
      const before = (await anon('/api/photos/' + pub.id)).body.photo.views;
      await anon('/api/photos/' + pub.id);
      assert.strictEqual((await anon('/api/photos/' + pub.id)).body.photo.views, before + 2);
      const own = (await alice('/api/photos/' + pub.id)).body.photo.views;
      assert.strictEqual((await alice('/api/photos/' + pub.id)).body.photo.views, own);

      await alice('/api/photos', { method: 'POST', form: (() => { const f = photoForm({ visibility: 'private' }); f.set('tags', 'secret-tag'); return f; })() });
      const tags = (await anon('/api/photos/tags/trending')).body.tags.map((t) => t.tag);
      assert.ok(tags.includes('sunset'));
      assert.ok(!tags.includes('secret-tag'));
    });

    await check('a post can hold several photos, and each one is access-checked', async () => {
      const multi = (visibility, count) => {
        const f = photoForm({ visibility, title: 'Trip ' + visibility });
        f.delete('image');
        for (let i = 0; i < count; i += 1) f.append('images', new Blob([PNG], { type: 'image/png' }), `p${i}.png`);
        return f;
      };
      const open = await alice('/api/photos', { method: 'POST', form: multi('public', 3) });
      assert.strictEqual(open.status, 201);
      assert.strictEqual(open.body.photo.imageCount, 3);
      assert.strictEqual(open.body.photo.images.length, 3);
      const trip = open.body.photo;

      for (const img of trip.images) assert.strictEqual((await anon(img.url)).status, 200);
      assert.strictEqual((await anon(trip.url.replace('/file', '/images/3'))).status, 404);

      const hidden = await alice('/api/photos', { method: 'POST', form: multi('private', 2) });
      for (const img of hidden.body.photo.images) {
        assert.strictEqual((await anon(img.url)).status, 404);
        assert.strictEqual((await bob(img.url)).status, 404);
        assert.strictEqual((await alice(img.url)).status, 200);
      }

      // Limits
      const tooMany = await alice('/api/photos', { method: 'POST', form: multi('public', 11) });
      assert.strictEqual(tooMany.status, 400);

      // Only the owner can add or remove images.
      const extra = new FormData();
      extra.append('images', new Blob([PNG], { type: 'image/png' }), 'more.png');
      assert.strictEqual((await bob('/api/photos/' + trip.id + '/images', { method: 'POST', form: extra })).status, 404);
      assert.strictEqual((await bob('/api/photos/' + trip.id + '/images/0', { method: 'DELETE' })).status, 404);

      const more = new FormData();
      more.append('images', new Blob([PNG], { type: 'image/png' }), 'more.png');
      const added = await alice('/api/photos/' + trip.id + '/images', { method: 'POST', form: more });
      assert.strictEqual(added.status, 201);
      assert.strictEqual(added.body.photo.imageCount, 4);

      const removed = await alice('/api/photos/' + trip.id + '/images/0', { method: 'DELETE' });
      assert.strictEqual(removed.body.photo.imageCount, 3);

      // A post always keeps at least one photo.
      await alice('/api/photos/' + trip.id + '/images/0', { method: 'DELETE' });
      await alice('/api/photos/' + trip.id + '/images/0', { method: 'DELETE' });
      const last = await alice('/api/photos/' + trip.id + '/images/0', { method: 'DELETE' });
      assert.strictEqual(last.status, 400);

      // Deleting the post removes the remaining image too.
      const remaining = (await alice('/api/photos/' + trip.id)).body.photo.images[0].url;
      await alice('/api/photos/' + trip.id, { method: 'DELETE' });
      assert.strictEqual((await anon(remaining)).status, 404);
    });

    await check('new accounts get private, removable sample content', async () => {
      process.env.STARTER_CONTENT = 'on';
      const dave = client();
      const reg = await dave('/api/auth/register', { method: 'POST', json: { name: 'Dave', email: 'dave@example.com', password: 'password123' } });
      process.env.STARTER_CONTENT = 'off';
      assert.strictEqual(reg.status, 201);

      const mine = await dave('/api/photos/mine');
      assert.strictEqual(mine.body.total, 6);
      assert.strictEqual(mine.body.sampleCount, 6);
      assert.ok(mine.body.items.every((p) => p.visibility === 'private' && p.sample));
      assert.strictEqual((await dave('/api/albums')).body.albums.length, 1);

      // Sample posts are private: nobody else sees them, and they stay off Explore.
      const first = mine.body.items[0];
      assert.strictEqual((await anon(first.url)).status, 404);
      assert.strictEqual((await bob(first.url)).status, 404);
      assert.ok(!(await anon('/api/photos')).body.items.some((p) => p.sample));

      // Another account's samples cannot be removed by someone else.
      assert.strictEqual((await anon('/api/photos/samples', { method: 'DELETE' })).status, 401);
      const gone = await dave('/api/photos/samples', { method: 'DELETE' });
      assert.strictEqual(gone.body.removed, 6);
      assert.strictEqual((await dave('/api/photos/mine')).body.total, 0);
      assert.strictEqual((await dave('/api/albums')).body.albums.length, 0);
    });

    await check('stats count only public content', async () => {
      const stats = (await anon('/api/stats')).body;
      const list = (await anon('/api/photos')).body;
      assert.strictEqual(stats.photos, list.total);
      assert.ok(stats.creators >= 1);
    });

    await check('deleting a photo removes it', async () => {
      assert.strictEqual((await alice('/api/photos/' + pub.id, { method: 'DELETE' })).status, 200);
      assert.strictEqual((await anon(pub.url)).status, 404);
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
