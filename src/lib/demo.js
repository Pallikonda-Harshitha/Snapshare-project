// Demo content for a fresh site.
//
// When the site starts with no public posts (a new deployment, or a host whose
// disk was reset), the demo accounts and their public posts, likes and comments
// are added, so visitors never land on an empty gallery. Set DEMO_CONTENT=off
// to disable this.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../store');
const { root, uploadDir } = require('../config');
const { PASSWORD, USERS, POSTS, COMMENTS } = require('../../seed/content');

const SOURCE_DIR = path.join(root, 'seed', 'images');
const HOUR = 60 * 60 * 1000;

function copyImage(file) {
  const from = path.join(SOURCE_DIR, file);
  if (!fs.existsSync(from)) return null;
  const filename = crypto.randomBytes(16).toString('hex') + path.extname(file);
  const to = path.join(uploadDir, filename);
  fs.copyFileSync(from, to);
  return { filename, mime: 'image/jpeg', size: fs.statSync(to).size };
}

// Returns the number of demo posts added (0 when nothing was needed).
function ensureDemoContent() {
  if (process.env.DEMO_CONTENT === 'off') return 0;
  if (db.photos.find((p) => p.visibility === 'public').length > 0) return 0;
  if (!fs.existsSync(SOURCE_DIR)) return 0;
  fs.mkdirSync(uploadDir, { recursive: true });

  // Demo accounts (reused if they already exist). They already have posts,
  // so they do not get the private starter set.
  const passwordHash = bcrypt.hashSync(PASSWORD, 10);
  const userIds = {};
  for (const u of USERS) {
    const existing = db.users.find((x) => x.email === u.email)[0];
    const user = existing || db.users.insert({ name: u.name, email: u.email, passwordHash, bio: '', starterAdded: true });
    userIds[u.key] = user.id;
  }

  // Public posts, spread over the last hours so the order looks natural.
  const postIds = {};
  POSTS.forEach((p, i) => {
    const images = p.files.map(copyImage).filter(Boolean);
    if (!images.length) return;
    const post = db.photos.insert({
      ownerId: userIds[p.by],
      images,
      filename: images[0].filename,
      mime: images[0].mime,
      size: images[0].size,
      views: 0,
      title: p.title,
      description: p.description,
      tags: p.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
      category: p.category,
      visibility: 'public',
      albumId: null,
      createdAt: new Date(Date.now() - (POSTS.length - i) * HOUR).toISOString(),
    });
    postIds[p.title] = post.id;
  });

  // Each demo user likes most of the other one's posts.
  POSTS.forEach((p, i) => {
    if (i % 4 === 3 || !postIds[p.title]) return;
    const liker = p.by === 'arjun' ? 'priya' : 'arjun';
    db.likes.insert({ photoId: postIds[p.title], userId: userIds[liker] });
  });

  for (const [who, title, text] of COMMENTS) {
    if (postIds[title]) db.comments.insert({ photoId: postIds[title], userId: userIds[who], text });
  }

  return Object.keys(postIds).length;
}

module.exports = { ensureDemoContent };
