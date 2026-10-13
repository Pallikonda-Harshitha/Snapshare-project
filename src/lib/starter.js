// Starter content for new (and currently empty) accounts, so My Photos and
// Albums never open as blank pages. Everything added here is private to the
// account, marked `sample: true`, and can be removed in one click.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../store');
const { root, uploadDir } = require('../config');

const SOURCE_DIR = path.join(root, 'seed', 'images');

const STARTER = [
  { file: 'photo-29.jpg', title: 'Mountain morning', category: 'Travel', tags: ['travel', 'mountains', 'snow'],
    description: 'A sample photo to get you started. Edit it, move it to an album, or delete it.' },
  { file: 'photo-15.jpg', title: 'Forest waterfall', category: 'Nature', tags: ['nature', 'waterfall', 'hiking'],
    description: 'Sample photos are private to you until you make them public.' },
  { file: 'photo-237.jpg', title: 'Puppy portrait', category: 'Animals', tags: ['pets', 'dog', 'puppy'],
    description: 'Try liking, commenting and switching visibility on this one.' },
  { file: 'photo-42.jpg', title: 'Cafe table', category: 'Food', tags: ['food', 'coffee', 'cafe'],
    description: 'Open the post to see the full-screen viewer.' },
  { file: 'photo-48.jpg', title: 'Desk and laptop', category: 'Technology', tags: ['tech', 'workspace', 'laptop'],
    description: 'Use Add photos on a post to put several photos in one post.' },
  { file: 'photo-133.jpg', title: 'Classic cars', category: 'Events', tags: ['events', 'cars', 'vintage'],
    description: 'Remove all sample photos from My Photos whenever you like.' },
];

const enabled = () => process.env.STARTER_CONTENT !== 'off';

// Adds the starter album and posts to one account. Returns how many posts were added.
function addStarterContent(user) {
  if (!enabled() || !fs.existsSync(SOURCE_DIR)) return 0;

  const album = db.albums.insert({
    ownerId: user.id,
    name: 'Getting started',
    description: 'Sample photos to help you explore SnapShare. Keep, edit or delete any of them.',
    visibility: 'private',
    sample: true,
  });

  let added = 0;
  fs.mkdirSync(uploadDir, { recursive: true });
  for (const item of STARTER) {
    const from = path.join(SOURCE_DIR, item.file);
    if (!fs.existsSync(from)) continue;
    // Each account gets its own copy, so deleting one never affects another.
    const filename = crypto.randomBytes(16).toString('hex') + '.jpg';
    fs.copyFileSync(from, path.join(uploadDir, filename));
    const size = fs.statSync(path.join(uploadDir, filename)).size;
    db.photos.insert({
      ownerId: user.id,
      images: [{ filename, mime: 'image/jpeg', size }],
      filename,
      mime: 'image/jpeg',
      size,
      views: 0,
      title: item.title,
      description: item.description,
      tags: item.tags,
      category: item.category,
      visibility: 'private',
      albumId: album.id,
      sample: true,
    });
    added += 1;
  }
  db.users.update(user.id, { starterAdded: true });
  return added;
}

// Runs once at startup: accounts that exist but have nothing yet get the starter set.
function backfillStarterContent() {
  let accounts = 0;
  for (const user of db.users.find((u) => !u.starterAdded)) {
    const hasPosts = db.photos.find((p) => p.ownerId === user.id).length > 0;
    if (hasPosts) {
      db.users.update(user.id, { starterAdded: true });
    } else if (addStarterContent(user) > 0) {
      accounts += 1;
    }
  }
  return accounts;
}

// Removes every sample post (and the sample album) from one account.
function removeSamples(user) {
  const samples = db.photos.find((p) => p.ownerId === user.id && p.sample);
  for (const photo of samples) {
    db.photos.remove(photo.id);
    db.likes.find((l) => l.photoId === photo.id).forEach((l) => db.likes.remove(l.id));
    db.comments.find((c) => c.photoId === photo.id).forEach((c) => db.comments.remove(c.id));
    (photo.images && photo.images.length ? photo.images : [{ filename: photo.filename }]).forEach((im) =>
      fs.unlink(path.join(uploadDir, im.filename), () => {})
    );
  }
  for (const album of db.albums.find((a) => a.ownerId === user.id && a.sample)) {
    // Anything the user filed into the sample album themselves is kept.
    db.photos.find((p) => p.albumId === album.id).forEach((p) => db.photos.update(p.id, { albumId: null }));
    db.albums.remove(album.id);
  }
  return samples.length;
}

module.exports = { addStarterContent, backfillStarterContent, removeSamples };
