require('dotenv').config();
const bcrypt = require('bcryptjs');
const Admin = require('./models/Admin');
const { connectDatabase, disconnectDatabase } = require('./utils/database');

// Seed a persistent admin account into the configured MongoDB instance.
const seed = async () => {
  await connectDatabase({ allowMemoryFallback: false });

  const existingAdmin = await Admin.findOne({ username: 'admin' });

  if (existingAdmin) {
    console.log('Admin already exists.');
  } else {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('admin123', salt);

    await Admin.create({ username: 'admin', passwordHash });
    console.log('Admin created: username=admin, password=admin123');
  }

  await disconnectDatabase();
};

seed().catch((error) => {
  console.error('Admin seed failed:', error);
  process.exit(1);
});
