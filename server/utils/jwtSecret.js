const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SECRET_FILE = path.join(__dirname, '..', '.jwt-secret');

/**
 * Returns the JWT secret used by the app.
 *
 * Priority:
 * 1) process.env.JWT_SECRET
 * 2) server/.jwt-secret (persisted across restarts)
 * 3) generated in-memory (fallback; should rarely happen)
 */
function getJwtSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim()) {
    return process.env.JWT_SECRET.trim();
  }

  try {
    if (fs.existsSync(SECRET_FILE)) {
      const existing = String(fs.readFileSync(SECRET_FILE, 'utf8')).trim();
      // Basic sanity: secret should look like a hex string.
      if (existing && /^[0-9a-fA-F]{32,}$/.test(existing)) return existing;
      // If file contains placeholder text, ignore and regenerate.
    }

    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(SECRET_FILE, generated, { encoding: 'utf8', flag: 'wx' });
    return generated;
  } catch (e) {
    // In case file write fails (permissions), fallback to per-process secret.
    if (!global.__APPOINTEASE_JWT_SECRET__) {
      global.__APPOINTEASE_JWT_SECRET__ = crypto.randomBytes(32).toString('hex');
    }
    return global.__APPOINTEASE_JWT_SECRET__;
  }
}

module.exports = { getJwtSecret };


