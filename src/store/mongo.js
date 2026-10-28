// MongoDB sink for the data layer.
//
// Data is loaded into memory at startup and each change is written to MongoDB
// in the background, in order. Reads stay synchronous and fast, and the routes
// are unchanged. Set MONGODB_URI (and optionally MONGODB_DB) to use it.
//
// Image files are also copied into MongoDB (GridFS bucket "images"). Hosts such
// as Render's free plan wipe the local disk on restart, so on startup any image
// missing from the uploads folder is restored from MongoDB.

const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { uploadDir } = require('../config');

// A post holds one or more images. Older posts only have `filename` on the post itself.
const imageNamesOf = (photo) =>
  (photo.images && photo.images.length ? photo.images : [{ filename: photo.filename }])
    .map((im) => im.filename)
    .filter(Boolean);

function createMongoSink(uri, dbName, names, state) {
  let database = null;
  let bucket = null;
  // Filenames already saved in GridFS, and the images each post had last time we looked.
  const stored = new Set();
  const imagesByPost = new Map();
  // One promise chain keeps writes in the order they were made.
  let queue = Promise.resolve();

  const enqueue = (label, work) => {
    queue = queue.then(work).catch((err) => console.error(`[mongo] ${label} failed:`, err.message));
  };

  const col = (name) => database.collection(name);

  async function saveImage(filename) {
    const file = path.join(uploadDir, filename);
    if (stored.has(filename) || !fs.existsSync(file)) return;
    await pipeline(fs.createReadStream(file), bucket.openUploadStream(filename));
    stored.add(filename);
  }

  async function deleteImage(filename) {
    for (const doc of await bucket.find({ filename }).toArray()) await bucket.delete(doc._id);
    stored.delete(filename);
  }

  async function restoreImage(filename) {
    const file = path.join(uploadDir, filename);
    if (fs.existsSync(file) || !stored.has(filename)) return false;
    // Download to a temp name first so a failed download never leaves a broken image.
    await pipeline(bucket.openDownloadStreamByName(filename), fs.createWriteStream(file + '.part'));
    fs.renameSync(file + '.part', file);
    return true;
  }

  // Saves a post's new images and deletes the ones it no longer has.
  async function syncImages(photo, { removed = false } = {}) {
    const before = imagesByPost.get(photo.id) || [];
    const after = removed ? [] : imageNamesOf(photo);
    if (removed) imagesByPost.delete(photo.id);
    else imagesByPost.set(photo.id, after);
    for (const f of after) await saveImage(f);
    for (const f of before) if (!after.includes(f)) await deleteImage(f);
  }

  return {
    // `importFile` is the old JSON data file. If MongoDB is empty, its rows are
    // copied in once so existing accounts and posts carry over.
    async load(importFile) {
      const { MongoClient, GridFSBucket } = require('mongodb');
      const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
      await client.connect();
      database = client.db(dbName);
      bucket = new GridFSBucket(database, { bucketName: 'images' });

      const counts = await Promise.all(names.map((n) => col(n).countDocuments()));
      if (counts.every((c) => c === 0) && importFile && fs.existsSync(importFile)) {
        const old = JSON.parse(fs.readFileSync(importFile, 'utf8'));
        for (const name of names) {
          if (old[name] && old[name].length) await col(name).insertMany(old[name].map((r) => ({ ...r })));
        }
        console.log(`[mongo] Imported existing data from ${importFile}`);
      }

      for (const name of names) {
        const docs = await col(name).find({}).toArray();
        // Mongo adds _id; the app uses its own string `id`.
        state[name] = docs.map(({ _id, ...rest }) => rest);
      }

      // Bring the uploads folder and GridFS in line: restore files the disk lost,
      // and save files that are on disk but not yet in MongoDB.
      fs.mkdirSync(uploadDir, { recursive: true });
      for (const doc of await bucket.find({}, { projection: { filename: 1 } }).toArray()) stored.add(doc.filename);
      let restored = 0;
      let saved = 0;
      for (const photo of state.photos || []) {
        const files = imageNamesOf(photo);
        imagesByPost.set(photo.id, files);
        for (const f of files) {
          if (await restoreImage(f)) restored += 1;
          else if (!stored.has(f) && fs.existsSync(path.join(uploadDir, f))) {
            await saveImage(f);
            saved += 1;
          }
        }
      }
      if (restored) console.log(`[mongo] Restored ${restored} image file(s) from MongoDB`);
      if (saved) console.log(`[mongo] Saved ${saved} image file(s) to MongoDB`);
    },
    insert(name, row) {
      enqueue(`insert ${name}`, () => col(name).insertOne({ ...row }));
      if (name === 'photos') enqueue('save images', () => syncImages(row));
    },
    update(name, row) {
      enqueue(`update ${name}`, () => col(name).replaceOne({ id: row.id }, { ...row }, { upsert: true }));
      if (name === 'photos') enqueue('save images', () => syncImages(row));
    },
    remove(name, id, row) {
      enqueue(`remove ${name}`, () => col(name).deleteOne({ id }));
      if (name === 'photos' && row) enqueue('delete images', () => syncImages(row, { removed: true }));
    },
  };
}

module.exports = { createMongoSink };
