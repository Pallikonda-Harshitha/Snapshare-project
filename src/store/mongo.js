// MongoDB sink for the data layer.
//
// Data is loaded into memory at startup and each change is written to MongoDB
// in the background, in order. Reads stay synchronous and fast, and the routes
// are unchanged. Set MONGODB_URI (and optionally MONGODB_DB) to use it.

const fs = require('fs');

function createMongoSink(uri, dbName, names, state) {
  let database = null;
  // One promise chain keeps writes in the order they were made.
  let queue = Promise.resolve();

  const enqueue = (label, work) => {
    queue = queue.then(work).catch((err) => console.error(`[mongo] ${label} failed:`, err.message));
  };

  const col = (name) => database.collection(name);

  return {
    // `importFile` is the old JSON data file. If MongoDB is empty, its rows are
    // copied in once so existing accounts and posts carry over.
    async load(importFile) {
      const { MongoClient } = require('mongodb');
      const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
      await client.connect();
      database = client.db(dbName);

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
    },
    insert(name, row) {
      enqueue(`insert ${name}`, () => col(name).insertOne({ ...row }));
    },
    update(name, row) {
      enqueue(`update ${name}`, () => col(name).replaceOne({ id: row.id }, { ...row }, { upsert: true }));
    },
    remove(name, id) {
      enqueue(`remove ${name}`, () => col(name).deleteOne({ id }));
    },
  };
}

module.exports = { createMongoSink };
