// Data access layer.
//
// Every route talks to `db.users`, `db.photos`, `db.albums`, `db.likes` and
// `db.comments` through the same small API (insert, findById, find, update,
// remove). Today that API is backed by a JSON file so the project runs with zero
// setup. To move to MongoDB, replace the body of this file with Mongoose models
// exposing the same methods; routes stay as is.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { dataFile } = require('../config');

fs.mkdirSync(path.dirname(dataFile), { recursive: true });

const state = { users: [], photos: [], albums: [], likes: [], comments: [] };
if (fs.existsSync(dataFile)) {
  Object.assign(state, JSON.parse(fs.readFileSync(dataFile, 'utf8')));
}

function persist() {
  const tmp = dataFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, dataFile);
}

function collection(name) {
  const rows = () => state[name];
  return {
    insert(doc) {
      const row = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...doc };
      rows().push(row);
      persist();
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
      persist();
      return row;
    },
    remove(id) {
      const i = rows().findIndex((r) => r.id === id);
      if (i === -1) return false;
      rows().splice(i, 1);
      persist();
      return true;
    },
  };
}

module.exports = {
  users: collection('users'),
  photos: collection('photos'),
  albums: collection('albums'),
  likes: collection('likes'),
  comments: collection('comments'),
};
