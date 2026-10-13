const express = require('express');
const db = require('../store');
const { requireAuth } = require('../middleware/auth');
const { visibilities } = require('../config');
const { serialize: serializePhoto } = require('./photos');

const router = express.Router();

const isOwner = (album, user) => Boolean(user) && album.ownerId === user.id;
const canView = (album, user) => album.visibility === 'public' || isOwner(album, user);

function serialize(album, user) {
  const photos = db.photos.find((p) => p.albumId === album.id);
  const visible = photos.filter((p) => isOwner(album, user) || p.visibility === 'public');
  return {
    id: album.id,
    name: album.name,
    description: album.description,
    visibility: album.visibility,
    createdAt: album.createdAt,
    isOwner: isOwner(album, user),
    owner: { id: album.ownerId, name: (db.users.findById(album.ownerId) || {}).name || 'Unknown' },
    photoCount: visible.length,
    cover: visible[0] ? `/api/photos/${visible[0].id}/file` : null,
    sample: Boolean(album.sample),
  };
}

function readFields(body, { partial }) {
  const fields = {};
  if (!partial || body.name !== undefined) {
    const name = String(body.name || '').trim();
    if (!name || name.length > 80) return { error: 'Album name is required (up to 80 characters).' };
    fields.name = name;
  }
  if (!partial || body.description !== undefined) {
    const description = String(body.description || '').trim();
    if (description.length > 300) return { error: 'Description can be up to 300 characters.' };
    fields.description = description;
  }
  if (!partial || body.visibility !== undefined) {
    const visibility = body.visibility || 'private';
    if (!visibilities.includes(visibility)) return { error: 'Visibility must be public or private.' };
    fields.visibility = visibility;
  }
  return { fields };
}

router.get('/', requireAuth, (req, res) => {
  const albums = db.albums
    .find((a) => a.ownerId === req.user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ albums: albums.map((a) => serialize(a, req.user)) });
});

router.post('/', requireAuth, (req, res) => {
  const { fields, error } = readFields(req.body, { partial: false });
  if (error) return res.status(400).json({ error });
  const album = db.albums.insert({ ownerId: req.user.id, ...fields });
  res.status(201).json({ album: serialize(album, req.user) });
});

// Non-owners only see an album if it is public, and only its public photos.
router.get('/:id', (req, res) => {
  const album = db.albums.findById(req.params.id);
  if (!album || !canView(album, req.user)) return res.status(404).json({ error: 'Album not found.' });
  const photos = db.photos
    .find((p) => p.albumId === album.id && (isOwner(album, req.user) || p.visibility === 'public'))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((p) => serializePhoto(p, req.user));
  res.json({ album: serialize(album, req.user), photos });
});

router.patch('/:id', requireAuth, (req, res) => {
  const album = db.albums.findById(req.params.id);
  if (!album || !isOwner(album, req.user)) return res.status(404).json({ error: 'Album not found.' });
  const { fields, error } = readFields(req.body, { partial: true });
  if (error) return res.status(400).json({ error });
  res.json({ album: serialize(db.albums.update(album.id, fields), req.user) });
});

// Deleting an album keeps its photos; they just become unassigned.
router.delete('/:id', requireAuth, (req, res) => {
  const album = db.albums.findById(req.params.id);
  if (!album || !isOwner(album, req.user)) return res.status(404).json({ error: 'Album not found.' });
  db.photos.find((p) => p.albumId === album.id).forEach((p) => db.photos.update(p.id, { albumId: null }));
  db.albums.remove(album.id);
  res.json({ ok: true });
});

module.exports = router;
