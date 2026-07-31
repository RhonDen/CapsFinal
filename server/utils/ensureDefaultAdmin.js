const bcrypt = require('bcryptjs');

/**
 * Ensures a default admin account exists in the database.
 *
 * In production (Vercel), credentials are read from environment variables:
 *   DEFAULT_ADMIN_USERNAME  (default: "admin")
 *   DEFAULT_ADMIN_PASSWORD  (default: "admin123")
 *
 * ⚠️ IMPORTANT: On Vercel, set DEFAULT_ADMIN_PASSWORD to a strong password
 *    via the Vercel Dashboard (Project Settings → Environment Variables).
 */
async function ensureDefaultAdmin() {
  // Require the model lazily after the DB connection is established to avoid circular
  // dependency issues where models import the DB before it's initialized.
  const Admin = require('../models/Admin');

  const username = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
  const password = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
  const existingAdmin = await Admin.findOne({ where: { username } });

  if (existingAdmin) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  await Admin.create({ username, passwordHash });

  const env = process.env.NODE_ENV || 'development';
  console.log(
    `Default admin created (${env}): username=${username}, password=${password}`
  );
}

module.exports = ensureDefaultAdmin;
