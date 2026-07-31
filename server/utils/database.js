const { Sequelize } = require('sequelize');
const path = require('path');

const dialect = process.env.DB_DIALECT || 'sqlite';
const host = process.env.DB_HOST || 'localhost';
const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
const database = process.env.DB_NAME || 'appointease';
const username = process.env.DB_USER || 'root';
const password = process.env.DB_PASSWORD || '';
const sqliteStorage = process.env.SQLITE_STORAGE || path.join(__dirname, '..', 'database.sqlite');
const postgresUri = process.env.POSTGRES_URI || '';

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
} else if (dialect === 'postgres') {
  // Clean the URI - remove unsupported params like channel_binding
  let cleanUri = postgresUri;
  if (cleanUri) {
    // Remove channel_binding parameter which pg driver doesn't support
    cleanUri = cleanUri.replace(/[?&]channel_binding=[^&]*/g, '');
    // Use direct connection (non-pooled) for better compatibility with Sequelize
    cleanUri = cleanUri.replace(/-pooler/, '');
  }
  sequelize = new Sequelize(cleanUri, {
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false, // Required for Neon/Vercel Postgres SSL
      },
    },
    logging: false,
    define: {
      timestamps: true,
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
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

    // Sync models (creates tables if missing, adds new columns if they don't exist)
    await sequelize.sync({ alter: true });

    return {
      mode: dialect,
      uri: dialect === 'sqlite' ? sqliteStorage : dialect === 'postgres' ? postgresUri : `${username}@${host}:${port}/${database}`,
    };
  } catch (error) {
    // Production safety: do not silently fall back.
    if (dialect === 'mysql') {
      console.error('MySQL connection error:', error);
    } else if (dialect === 'postgres') {
      console.error('PostgreSQL connection error:', error);
    } else {
      console.error('Database connection error:', error);
    }
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
