const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config');
const db = require('../store');

const COOKIE = 'snapshare_token';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function issueToken(res, user) {
  const token = jwt.sign({ sub: user.id }, jwtSecret, { expiresIn: '7d' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: WEEK_MS,
  });
}

function clearToken(res) {
  res.clearCookie(COOKIE);
}

// Attaches req.user when a valid session cookie is present; never rejects.
function attachUser(req, _res, next) {
  req.user = null;
  const token = req.cookies && req.cookies[COOKIE];
  if (token) {
    try {
      const { sub } = jwt.verify(token, jwtSecret);
      req.user = db.users.findById(sub);
    } catch {
      // expired or tampered token: treat as logged out
    }
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Log in to continue.' });
  next();
}

module.exports = { issueToken, clearToken, attachUser, requireAuth };
