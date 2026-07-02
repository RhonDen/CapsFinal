const { Sequelize } = require('sequelize');
const path = require('path');

const dialect = process.env.DB_DIALECT || 'sqlite';
const host = process.env.DB_HOST || 'localhost';
const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
const database = process.env.DB_NAME || 'appointease';
const username = process.env.DB_USER || 'root';
const password = process.env.DB_PASSWORD || '';
const sqliteStorage = process.env.SQLITE_STORAGE || path.join(__dirname, '..', 'database.sqlite');

let sequelize;
if (dialect === 'sqlite') {
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: sqliteStorage,
    logging: false,
    define: {
      timestamps: true,
    },
  });
} else {
  sequelize = new Sequelize(database, username, password, {
    host,
    port,
    dialect: 'mysql',
    logging: false,
    define: {
      timestamps: true,
    },
  });
}

async function connectDatabase() {
  try {
    await sequelize.authenticate();

    // Load models so they register with Sequelize
    require('../models/Appointment');
    require('../models/BlockedDate');
    require('../models/Admin');
    require('../models/ContactMessage');
    require('../models/Counter');

    // Sync models (creates tables if missing)
    await sequelize.sync();

    return {
      mode: dialect,
      uri: dialect === 'sqlite' ? sqliteStorage : `${username}@${host}:${port}/${database}`,
    };
  } catch (error) {
    // Production safety: do not silently fall back from MySQL.
    if (dialect === 'mysql') {
      console.error('MySQL connection error:', error);
      throw error;
    }

    console.error('Database connection error:', error);
    throw error;
  }
}


async function disconnectDatabase() {
  if (sequelize) {
    await sequelize.close();
  }
}

module.exports = {
  connectDatabase,
  disconnectDatabase,
  sequelize,
};
