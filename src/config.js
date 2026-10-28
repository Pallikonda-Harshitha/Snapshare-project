require('dotenv').config();
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');

let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  jwtSecret = crypto.randomBytes(32).toString('hex');
  console.warn('[config] JWT_SECRET not set. Using a temporary secret; logins reset on restart.');
}

module.exports = {
  port: Number(process.env.PORT) || 3000,
  jwtSecret,
  root,
  publicDir: path.join(root, 'public'),
  uploadDir: process.env.UPLOAD_DIR || path.join(root, 'uploads'),
  dataFile: process.env.DATA_FILE || path.join(root, 'data', 'db.json'),
  // Leave MONGODB_URI empty to store data in dataFile instead.
  mongoUri: process.env.MONGODB_URI || '',
  mongoDb: process.env.MONGODB_DB || 'snapshare',
  maxFileSize: 10 * 1024 * 1024,
  maxImagesPerPost: 10,
  categories: ['Nature', 'Travel', 'Technology', 'Food', 'People', 'Animals', 'Architecture', 'Events', 'Other'],
  visibilities: ['public', 'private'],
};
