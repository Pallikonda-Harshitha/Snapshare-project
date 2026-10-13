const express = require('express');
const path = require('path');
const db = require('../store');
const { requireAuth } = require('../middleware/auth');
const { imageFields, filesOf, matchesSignature, removeFile, uploadDir } = require('../middleware/upload');
const { categories, visibilities, maxImagesPerPost } = require('../config');
const { removeSamples } = require('../lib/starter');

const router = express.Router();

const isOwner = (photo, user) => Boolean(user) && photo.ownerId === user.id;
// Private posts are reported as "not found" to everyone except the owner.
const canView = (photo, user) => photo.visibility === 'public' || isOwner(photo, user);

// A post holds one or more images. Posts saved before multi-image support only
// have filename/mime/size on the post itself, so treat those as a single image.
const imagesOf = (photo) =>
  photo.images && photo.images.length
    ? photo.images
    : [{ filename: photo.filename, mime: photo.mime, size: photo.size }];

const likeCount = (photoId) => db.likes.find((l) => l.photoId === photoId).length;

function serialize(photo, user) {
  const owner = db.users.findById(photo.ownerId);
  const images = imagesOf(photo);
  return {
    id: photo.id,
    title: photo.title,
    description: photo.description,
    tags: photo.tags,
    category: photo.category,
    visibility: photo.visibility,
    albumId: photo.albumId,
    size: images.reduce((sum, im) => sum + im.size, 0),
    createdAt: photo.createdAt,
    owner: { id: photo.ownerId, name: owner ? owner.name : 'Unknown' },
    isOwner: isOwner(photo, user),
    url: `/api/photos/${photo.id}/file`,
    images: images.map((im, i) => ({ url: `/api/photos/${photo.id}/images/${i}`, size: im.size })),
    imageCount: images.length,
    likeCount: likeCount(photo.id),
    liked: Boolean(user) && db.likes.find((l) => l.photoId === photo.id && l.userId === user.id).length > 0,
    commentCount: db.comments.find((c) => c.photoId === photo.id).length,
    views: photo.views || 0,
    sample: Boolean(photo.sample),
  };
}

function serializeComment(comment, photo, user) {
  const author = db.users.findById(comment.userId);
  return {
    id: comment.id,
    text: comment.text,
    createdAt: comment.createdAt,
    author: { id: comment.userId, name: author ? author.name : 'Deleted user' },
    canDelete: Boolean(user) && (comment.userId === user.id || isOwner(photo, user)),
  };
}

function parseTags(raw) {
  const list = Array.isArray(raw) ? raw : String(raw || '').split(',');
  const clean = list.map((t) => String(t).trim().replace(/^#/, '').toLowerCase().slice(0, 30)).filter(Boolean);
  return [...new Set(clean)].slice(0, 10);
}

// Validates the editable fields shared by upload and edit. Returns { error } or { fields }.
function readFields(body, user, { partial }) {
  const fields = {};
  if (!partial || body.title !== undefined) {
    const title = String(body.title || '').trim();
    if (!title || title.length > 100) return { error: 'Title is required (up to 100 characters).' };
    fields.title = title;
  }
  if (!partial || body.description !== undefined) {
    const description = String(body.description || '').trim();
    if (description.length > 500) return { error: 'Description can be up to 500 characters.' };
    fields.description = description;
  }
  if (!partial || body.tags !== undefined) fields.tags = parseTags(body.tags);
  if (!partial || body.category !== undefined) {
    const category = body.category || 'Other';
    if (!categories.includes(category)) return { error: 'Choose a valid category.' };
    fields.category = category;
  }
  if (!partial || body.visibility !== undefined) {
    const visibility = body.visibility || 'private';
    if (!visibilities.includes(visibility)) return { error: 'Visibility must be public or private.' };
    fields.visibility = visibility;
  }
  if (!partial || body.albumId !== undefined) {
    const albumId = body.albumId || null;
    if (albumId) {
      const album = db.albums.findById(albumId);
      if (!album || album.ownerId !== user.id) return { error: 'Album not found.' };
    }
    fields.albumId = albumId;
  }
  return { fields };
}

function filterAndPage(rows, query, user) {
  const q = String(query.q || '').trim().toLowerCase().replace(/^#/, '');
  const category = String(query.category || '');
  const sort = ['oldest', 'liked'].includes(query.sort) ? query.sort : 'newest';
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 24, 1), 60);
  const page = Math.max(parseInt(query.page, 10) || 1, 1);

  let out = rows;
  if (category && categories.includes(category)) out = out.filter((p) => p.category === category);
  if (q) {
    out = out.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some((t) => t.includes(q))
    );
  }

  const newestFirst = (a, b) => b.createdAt.localeCompare(a.createdAt);
  if (sort === 'liked') {
    const counts = new Map();
    db.likes.find().forEach((l) => counts.set(l.photoId, (counts.get(l.photoId) || 0) + 1));
    out = [...out].sort((a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0) || newestFirst(a, b));
  } else {
    out = [...out].sort((a, b) => (sort === 'oldest' ? -newestFirst(a, b) : newestFirst(a, b)));
  }

  const total = out.length;
  const items = out.slice((page - 1) * limit, page * limit).map((p) => serialize(p, user));
  return { items, total, page, pages: Math.max(Math.ceil(total / limit), 1) };
}

// Checks every uploaded file's real signature. On failure all of them are deleted.
function validateUploads(files) {
  if (!files.length) return 'Choose at least one image to upload.';
  const bad = files.find((f) => !matchesSignature(f.path, f.mimetype));
  if (bad) {
    files.forEach((f) => removeFile(f.path));
    return 'One of those files is not a valid image.';
  }
  return null;
}

const toImage = (f) => ({ filename: f.filename, mime: f.mimetype, size: f.size });

function sendImage(req, res, photo, image) {
  res.set({
    'Content-Type': image.mime,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': photo.visibility === 'public' ? 'public, max-age=300' : 'private, no-store',
  });
  if (req.query.download) {
    const safe = photo.title.replace(/[^\w\- ]+/g, '').trim() || 'photo';
    res.attachment(safe + path.extname(image.filename));
  }
  res.sendFile(path.join(uploadDir, image.filename));
}

// Public exploration: only public posts, with or without an account.
router.get('/', (req, res) => {
  const rows = db.photos.find((p) => p.visibility === 'public');
  res.json(filterAndPage(rows, req.query, req.user));
});

// The signed-in user's own posts, public and private.
router.get('/mine', requireAuth, (req, res) => {
  let rows = db.photos.find((p) => p.ownerId === req.user.id);
  if (visibilities.includes(req.query.visibility)) {
    rows = rows.filter((p) => p.visibility === req.query.visibility);
  }
  res.json({
    ...filterAndPage(rows, req.query, req.user),
    sampleCount: db.photos.find((p) => p.ownerId === req.user.id && p.sample).length,
  });
});

// Most used tags across public posts only.
router.get('/tags/trending', (_req, res) => {
  const counts = new Map();
  db.photos
    .find((p) => p.visibility === 'public')
    .forEach((p) => p.tags.forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
  const tags = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12)
    .map(([tag, count]) => ({ tag, count }));
  res.json({ tags });
});

// Create a post with one or more images.
router.post('/', requireAuth, imageFields, (req, res) => {
  const files = filesOf(req);
  const problem = validateUploads(files);
  if (problem) return res.status(400).json({ error: problem });

  const { fields, error } = readFields(req.body, req.user, { partial: false });
  if (error) {
    files.forEach((f) => removeFile(f.path));
    return res.status(400).json({ error });
  }

  const images = files.map(toImage);
  const photo = db.photos.insert({
    ownerId: req.user.id,
    images,
    // The first image is the cover; these mirror it for older records and tools.
    filename: images[0].filename,
    mime: images[0].mime,
    size: images[0].size,
    views: 0,
    ...fields,
  });
  res.status(201).json({ photo: serialize(photo, req.user) });
});

// Remove all of the account's starter photos at once. Registered before '/:id' on purpose.
router.delete('/samples', requireAuth, (req, res) => {
  res.json({ removed: removeSamples(req.user) });
});

router.get('/:id', (req, res) => {
  const photo = db.photos.findById(req.params.id);
  if (!photo || !canView(photo, req.user)) return res.status(404).json({ error: 'Photo not found.' });
  // Opening your own post does not inflate its view count.
  if (!isOwner(photo, req.user)) db.photos.update(photo.id, { views: (photo.views || 0) + 1 });
  res.json({ photo: serialize(photo, req.user) });
});

// Cover image. Same permission check as the metadata.
router.get('/:id/file', (req, res) => {
  const photo = db.photos.findById(req.params.id);
  if (!photo || !canView(photo, req.user)) return res.status(404).json({ error: 'Photo not found.' });
  sendImage(req, res, photo, imagesOf(photo)[0]);
});

// Any image in the post, by position.
router.get('/:id/images/:index', (req, res) => {
  const photo = db.photos.findById(req.params.id);
  if (!photo || !canView(photo, req.user)) return res.status(404).json({ error: 'Photo not found.' });
  const images = imagesOf(photo);
  const index = Number(req.params.index);
  if (!Number.isInteger(index) || index < 0 || index >= images.length) {
    return res.status(404).json({ error: 'Photo not found.' });
  }
  sendImage(req, res, photo, images[index]);
});

// Add more images to an existing post.
router.post('/:id/images', requireAuth, imageFields, (req, res) => {
  const files = filesOf(req);
  const discard = () => files.forEach((f) => removeFile(f.path));
  const photo = db.photos.findById(req.params.id);
  if (!photo || !isOwner(photo, req.user)) {
    discard();
    return res.status(404).json({ error: 'Photo not found.' });
  }
  const problem = validateUploads(files);
  if (problem) return res.status(400).json({ error: problem });

  const images = imagesOf(photo);
  if (images.length + files.length > maxImagesPerPost) {
    discard();
    return res.status(400).json({ error: `A post can hold up to ${maxImagesPerPost} photos.` });
  }
  const updated = db.photos.update(photo.id, { images: [...images, ...files.map(toImage)] });
  res.status(201).json({ photo: serialize(updated, req.user) });
});

// Remove one image from a post. A post always keeps at least one.
router.delete('/:id/images/:index', requireAuth, (req, res) => {
  const photo = db.photos.findById(req.params.id);
  if (!photo || !isOwner(photo, req.user)) return res.status(404).json({ error: 'Photo not found.' });
  const images = imagesOf(photo);
  const index = Number(req.params.index);
  if (!Number.isInteger(index) || index < 0 || index >= images.length) {
    return res.status(404).json({ error: 'Photo not found.' });
  }
  if (images.length === 1) {
    return res.status(400).json({ error: 'A post needs at least one photo. Delete the post instead.' });
  }
  const [removed] = images.splice(index, 1);
  removeFile(path.join(uploadDir, removed.filename));
  const updated = db.photos.update(photo.id, {
    images,
    filename: images[0].filename,
    mime: images[0].mime,
    size: images[0].size,
  });
  res.json({ photo: serialize(updated, req.user) });
});

router.patch('/:id', requireAuth, (req, res) => {
  const photo = db.photos.findById(req.params.id);
  if (!photo || !isOwner(photo, req.user)) return res.status(404).json({ error: 'Photo not found.' });
  const { fields, error } = readFields(req.body, req.user, { partial: true });
  if (error) return res.status(400).json({ error });
  const updated = db.photos.update(photo.id, fields);
  res.json({ photo: serialize(updated, req.user) });
});

router.delete('/:id', requireAuth, (req, res) => {
  const photo = db.photos.findById(req.params.id);
  if (!photo || !isOwner(photo, req.user)) return res.status(404).json({ error: 'Photo not found.' });
  db.photos.remove(photo.id);
  db.likes.find((l) => l.photoId === photo.id).forEach((l) => db.likes.remove(l.id));
  db.comments.find((c) => c.photoId === photo.id).forEach((c) => db.comments.remove(c.id));
  imagesOf(photo).forEach((im) => removeFile(path.join(uploadDir, im.filename)));
  res.json({ ok: true });
});

// Likes: one per user per post, toggled by the same call.
router.post('/:id/like', requireAuth, (req, res) => {
  const photo = db.photos.findById(req.params.id);
  if (!photo || !canView(photo, req.user)) return res.status(404).json({ error: 'Photo not found.' });
  const existing = db.likes.find((l) => l.photoId === photo.id && l.userId === req.user.id)[0];
  if (existing) db.likes.remove(existing.id);
  else db.likes.insert({ photoId: photo.id, userId: req.user.id });
  res.json({ liked: !existing, likeCount: likeCount(photo.id) });
});

router.get('/:id/comments', (req, res) => {
  const photo = db.photos.findById(req.params.id);
  if (!photo || !canView(photo, req.user)) return res.status(404).json({ error: 'Photo not found.' });
  const comments = db.comments
    .find((c) => c.photoId === photo.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((c) => serializeComment(c, photo, req.user));
  res.json({ comments });
});

router.post('/:id/comments', requireAuth, (req, res) => {
  const photo = db.photos.findById(req.params.id);
  if (!photo || !canView(photo, req.user)) return res.status(404).json({ error: 'Photo not found.' });
  const text = String(req.body.text || '').trim();
  if (!text || text.length > 500) {
    return res.status(400).json({ error: 'Write a comment of up to 500 characters.' });
  }
  const comment = db.comments.insert({ photoId: photo.id, userId: req.user.id, text });
  res.status(201).json({ comment: serializeComment(comment, photo, req.user) });
});

// A comment can be removed by its author or by the post's owner.
router.delete('/:id/comments/:commentId', requireAuth, (req, res) => {
  const photo = db.photos.findById(req.params.id);
  const comment = db.comments.findById(req.params.commentId);
  if (!photo || !comment || comment.photoId !== photo.id || !canView(photo, req.user)) {
    return res.status(404).json({ error: 'Comment not found.' });
  }
  if (comment.userId !== req.user.id && !isOwner(photo, req.user)) {
    return res.status(403).json({ error: "You can't remove this comment." });
  }
  db.comments.remove(comment.id);
  res.json({ ok: true });
});

module.exports = router;
module.exports.serialize = serialize;
