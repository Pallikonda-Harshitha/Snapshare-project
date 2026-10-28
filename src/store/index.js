// Data access layer.
//
// Every route talks to `db.users`, `db.photos`, `db.albums`, `db.likes` and
// `db.comments` through the same small API (insert, findById, find, update,
// remove). Data is held in memory for fast reads, and every change is written
// through to one of two places:
//
//   - MONGODB_URI set: MongoDB (see ./mongo.js)
//   - otherwise: a JSON file (data/db.json), so the project runs with no setup
//
// Routes never know which one is in use. `db.ready` resolves once data is loaded.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { dataFile, mongoUri, mongoDb } = require('../config');

const NAMES = ['users', 'photos', 'albums', 'likes', 'comments'];

const state = Object.fromEntries(NAMES.map((n) => [n, []]));

function createFileSink(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) Object.assign(state, JSON.parse(fs.readFileSync(file, 'utf8')));

  const persist = () => {
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, file);
  };
  return { load: async () => {}, insert: persist, update: persist, remove: persist };
}

const sink = mongoUri ? require('./mongo').createMongoSink(mongoUri, mongoDb, NAMES, state) : createFileSink(dataFile);

function collection(name) {
  const rows = () => state[name];
  return {
    insert(doc) {
      const row = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...doc };
      rows().push(row);
      sink.insert(name, row);
      return row;
    },
    findById(id) {
      return rows().find((r) => r.id === id) || null;
    },
    find(predicate = () => true) {
      return rows().filter(predicate);
    },
    update(id, patch) {
      const row = this.findById(id);
      if (!row) return null;
      Object.assign(row, patch);
      sink.update(name, row);
      return row;
    },
    remove(id) {
      const i = rows().findIndex((r) => r.id === id);
      if (i === -1) return false;
      const [row] = rows().splice(i, 1);
      sink.remove(name, id, row);
      return true;
    },
  };
}

const db = Object.fromEntries(NAMES.map((n) => [n, collection(n)]));

// The server waits for this before it starts listening.
db.ready = sink.load(dataFile);
db.backend = mongoUri ? 'MongoDB' : 'JSON file';

module.exports = db;
