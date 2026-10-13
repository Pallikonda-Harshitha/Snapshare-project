const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { uploadDir, maxFileSize, maxImagesPerPost } = require('../config');

fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    // Random name: the original filename is never trusted or reused on disk.
    filename: (_req, file, cb) =>
      cb(null, crypto.randomBytes(16).toString('hex') + (ALLOWED[file.mimetype] || '')),
  }),
  limits: { fileSize: maxFileSize, files: maxImagesPerPost },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED[file.mimetype]) {
      return cb(Object.assign(new Error('Only JPEG, PNG, WebP or GIF images are allowed.'), { status: 400 }));
    }
    cb(null, true);
  },
});

// The declared mimetype comes from the client, so also check the real file signature.
function matchesSignature(filePath, mimetype) {
  const buf = Buffer.alloc(12);
  const fd = fs.openSync(filePath, 'r');
  try {
    fs.readSync(fd, buf, 0, 12, 0);
  } finally {
    fs.closeSync(fd);
  }
  switch (mimetype) {
    case 'image/jpeg':
      return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    case 'image/png':
      return buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/gif':
      return buf.subarray(0, 4).toString('ascii') === 'GIF8';
    case 'image/webp':
      return buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP';
    default:
      return false;
  }
}

function removeFile(filePath) {
  fs.unlink(filePath, () => {});
}

// Accepts one or many images. `image` (single) is kept so older clients keep working.
const imageFields = upload.fields([
  { name: 'images', maxCount: maxImagesPerPost },
  { name: 'image', maxCount: 1 },
]);

function filesOf(req) {
  const f = req.files || {};
  return [...(f.images || []), ...(f.image || [])];
}

module.exports = { upload, imageFields, filesOf, matchesSignature, removeFile, uploadDir };
