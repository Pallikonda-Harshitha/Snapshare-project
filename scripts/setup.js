// First-run setup. Runs automatically after `npm install`.
// Creates a .env file with a fresh random JWT secret, so the project starts
// without any manual configuration. An existing .env is never touched.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const envFile = path.join(root, '.env');

try {
  if (!fs.existsSync(envFile)) {
    const example = path.join(root, '.env.example');
    const template = fs.existsSync(example) ? fs.readFileSync(example, 'utf8') : 'PORT=3000\nJWT_SECRET=\n';
    const secret = crypto.randomBytes(32).toString('hex');
    const content = /^JWT_SECRET=.*$/m.test(template)
      ? template.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`)
      : template + `\nJWT_SECRET=${secret}\n`;
    fs.writeFileSync(envFile, content);
    console.log('Created .env with a new JWT_SECRET.');
  }
} catch (err) {
  // Setup is a convenience. Never fail an install because of it.
  console.warn('Could not create .env automatically:', err.message);
}
