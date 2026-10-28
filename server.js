const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { port, publicDir, categories, maxFileSize } = require('./src/config');
const { attachUser } = require('./src/middleware/auth');

const app = express();
app.disable('x-powered-by');

app.use((_req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
  });
  next();
});
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(attachUser);

app.get('/api/meta', (_req, res) => res.json({ categories }));
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/photos', require('./src/routes/photos'));
app.use('/api/albums', require('./src/routes/albums'));
app.use('/api/stats', require('./src/routes/stats'));
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));

app.use(express.static(publicDir));
app.use((_req, res) => res.status(404).sendFile(path.join(publicDir, '404.html')));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `That image is larger than the ${Math.round(maxFileSize / 1048576)} MB limit.` });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({ error: 'A post can hold up to 10 photos.' });
  }
  // Checked before err.status, which body-parser also sets, so the raw parser message is never shown.
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request body.' });
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side. Try again.' });
});

if (require.main === module) {
  const db = require('./src/store');
  db.ready
    .then(() => {
      console.log(`Data storage: ${db.backend}`);
      const demo = require('./src/lib/demo').ensureDemoContent();
      if (demo) console.log(`Added ${demo} demo posts so the gallery is not empty.`);
      const filled = require('./src/lib/starter').backfillStarterContent();
      if (filled) console.log(`Added starter photos to ${filled} existing account${filled === 1 ? '' : 's'}.`);
      app.listen(port, () => console.log(`SnapShare running at http://localhost:${port}`));
    })
    .catch((err) => {
      console.error(`Could not connect to MongoDB: ${err.message}`);
      process.exit(1);
    });
}

module.exports = app;
