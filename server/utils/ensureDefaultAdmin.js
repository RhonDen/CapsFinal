const bcrypt = require('bcryptjs');

// Create a default admin automatically in local development when no admin account exists yet.
async function ensureDefaultAdmin() {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

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

  console.log(
    `Default admin created for development: username=${username}, password=${password}`
  );
}

module.exports = ensureDefaultAdmin;
