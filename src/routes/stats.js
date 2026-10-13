const express = require('express');
const db = require('../store');

const router = express.Router();

// Headline numbers for the home page. Counts only what is public.
router.get('/', (_req, res) => {
  const photos = db.photos.find((p) => p.visibility === 'public');
  const ids = new Set(photos.map((p) => p.id));
  res.json({
    photos: photos.length,
    creators: new Set(photos.map((p) => p.ownerId)).size,
    likes: db.likes.find((l) => ids.has(l.photoId)).length,
  });
});

module.exports = router;
