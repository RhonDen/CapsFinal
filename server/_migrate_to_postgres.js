/**
 * Migration Script: SQLite → PostgreSQL
 * 
 * This script reads ALL data from your existing SQLite database
 * and writes it to your new Vercel Postgres database.
 * 
 * Your SQLite data is NEVER deleted — this is a COPY operation.
 * 
 * Usage:
 *   npm install pg   (first time only)
 *   node server/_migrate_to_postgres.js
 * 
 * Required environment variables:
 *   POSTGRES_URI=postgresql://... (from Vercel Postgres dashboard)
 */

require('dotenv').config();
const path = require('path');
const { Sequelize } = require('sequelize');

// ── 1. Connect to existing SQLite ────────────────────────────────────
const sqlitePath = process.env.SQLITE_STORAGE || path.join(__dirname, 'database.sqlite');
console.log(`🔌 Connecting to SQLite at: ${sqlitePath}`);

const sqlite = new Sequelize({
  dialect: 'sqlite',
  storage: sqlitePath,
  logging: false,
  define: { timestamps: true },
});

// ── 2. Connect to Vercel Postgres ───────────────────────────────────
const pgUri = process.env.POSTGRES_URI;
if (!pgUri) {
  console.error('❌ POSTGRES_URI environment variable is not set.');
  console.error('   Set it to your Vercel Postgres connection string.');
  process.exit(1);
}

console.log('🔌 Connecting to PostgreSQL (Vercel Postgres)...');
const pg = new Sequelize(pgUri, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: { require: true, rejectUnauthorized: false },
  },
  logging: false,
  define: { timestamps: true },
});

// ── 3. Define models for both databases ─────────────────────────────
// We define them inline so we don't depend on the app's model files
// (which might have dialect-specific issues).

const defineModels = (sequelize) => {
  const DataTypes = require('sequelize').DataTypes;
  
  const Appointment = sequelize.define('Appointment', {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    serialNumber: { type: DataTypes.INTEGER, unique: true, allowNull: true },
    number: { type: DataTypes.STRING, allowNull: false },
    lastName: { type: DataTypes.STRING, allowNull: false },
    firstName: { type: DataTypes.STRING, allowNull: false },
    middleInitial: { type: DataTypes.STRING, allowNull: true },
    service: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: true },
    date: { type: DataTypes.DATE, allowNull: true },
    dateKey: { type: DataTypes.STRING, allowNull: true },
    time: { type: DataTypes.STRING, allowNull: true },
    durationMinutes: { type: DataTypes.INTEGER, allowNull: true },
    scheduledStart: { type: DataTypes.DATE, allowNull: true },
    scheduledEnd: { type: DataTypes.DATE, allowNull: true },
    status: { type: DataTypes.STRING, defaultValue: 'pending' },
    otp: { type: DataTypes.STRING, allowNull: true },
    otpExpires: { type: DataTypes.DATE, allowNull: true },
    verifiedAt: { type: DataTypes.DATE, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    isWalkIn: { type: DataTypes.BOOLEAN, defaultValue: false },
    historyOtp: { type: DataTypes.STRING, allowNull: true },
    historyOtpExpires: { type: DataTypes.DATE, allowNull: true },
  }, { tableName: 'Appointments', timestamps: true });

  const Admin = sequelize.define('Admin', {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    username: { type: DataTypes.STRING, allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING, allowNull: false },
  }, { tableName: 'Admins', timestamps: true });

  const BlockedDate = sequelize.define('BlockedDate', {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    date: { type: DataTypes.DATE, allowNull: false },
    reason: { type: DataTypes.STRING, allowNull: true },
  }, { tableName: 'BlockedDates', timestamps: true });

  const ContactMessage = sequelize.define('ContactMessage', {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(150), allowNull: false },
    email: { type: DataTypes.STRING(255), allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    ipAddress: { type: DataTypes.STRING(100), allowNull: true },
  }, { tableName: 'ContactMessages', timestamps: true });

  const Counter = sequelize.define('Counter', {
    id: { type: DataTypes.STRING, primaryKey: true },
    seq: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, { tableName: 'Counters', timestamps: true });

  return { Appointment, Admin, BlockedDate, ContactMessage, Counter };
};

// ── 4. Migration Logic ──────────────────────────────────────────────
const migrateTable = async (name, Model, pgModel) => {
  console.log(`\n📋 Migrating ${name}...`);
  
  const rows = await Model.findAll({ raw: true });
  console.log(`   Found ${rows.length} records in SQLite.`);

  if (rows.length === 0) {
    console.log(`   ✅ No records to migrate.`);
    return { name, count: 0 };
  }

  // Remove the 'id' field so PostgreSQL auto-generates new IDs
  // This prevents ID conflicts with existing sequences
  // Exception: Counters table uses string 'id' as primary key, so keep it
  const records = rows.map(row => {
    const { createdAt, updatedAt, ...data } = row;
    // For Counters, keep the id field (string primary key)
    // For other tables, remove id so PG auto-generates
    if (name !== 'Counters') {
      delete data.id;
    }
    // Include timestamps if they exist
    const record = { ...data };
    if (row.createdAt) record.createdAt = row.createdAt;
    if (row.updatedAt) record.updatedAt = row.updatedAt;
    return record;
  });

  try {
    await pgModel.bulkCreate(records, {
      ignoreDuplicates: true, // Skip if record already exists
    });
    console.log(`   ✅ Successfully migrated ${records.length} records.`);
    return { name, count: records.length };
  } catch (err) {
    console.error(`   ❌ Failed to migrate ${name}:`, err.message);
    return { name, count: 0, error: err.message };
  }
};

// ── 5. Run Migration ────────────────────────────────────────────────
const run = async () => {
  try {
    // Authenticate both
    await sqlite.authenticate();
    console.log('✅ SQLite connection OK');
    
    await pg.authenticate();
    console.log('✅ PostgreSQL connection OK');

    // Define models
    const sqliteModels = defineModels(sqlite);
    const pgModels = defineModels(pg);

    // Sync PostgreSQL tables (create if not exist)
    console.log('\n🔄 Creating PostgreSQL tables if needed...');
    await pg.sync({ alter: false });
    console.log('✅ PostgreSQL tables ready');

    // Migrate each table in order (Appointments last since it's the biggest)
    const tables = [
      ['Admins', sqliteModels.Admin, pgModels.Admin],
      ['Counters', sqliteModels.Counter, pgModels.Counter],
      ['BlockedDates', sqliteModels.BlockedDate, pgModels.BlockedDate],
      ['ContactMessages', sqliteModels.ContactMessage, pgModels.ContactMessage],
      ['Appointments', sqliteModels.Appointment, pgModels.Appointment],
    ];

    const results = [];
    for (const [name, src, dest] of tables) {
      const result = await migrateTable(name, src, dest);
      results.push(result);
    }

    // Summary
    console.log('\n═══════════════════════════════════════');
    console.log('📊 MIGRATION SUMMARY');
    console.log('═══════════════════════════════════════');
    let totalMigrated = 0;
    let totalFailed = 0;
    for (const r of results) {
      const icon = r.error ? '❌' : '✅';
      console.log(`   ${icon} ${r.name}: ${r.count} records${r.error ? ` (${r.error})` : ''}`);
      if (r.error) totalFailed++;
      else totalMigrated += r.count;
    }
    console.log('───────────────────────────────────────');
    console.log(`   Total migrated: ${totalMigrated} records`);
    console.log(`   Total failed: ${totalFailed} tables`);
    console.log('═══════════════════════════════════════\n');
    
    if (totalFailed === 0) {
      console.log('🎉 Migration complete! Your data is now in Vercel Postgres.');
      console.log('👉 Next step: Set DB_DIALECT=postgres and POSTGRES_URI on Render');
      console.log('👉 Then restart your Render service.');
    } else {
      console.log('⚠️  Some tables had errors. Check the output above.');
    }

  } catch (err) {
    console.error('\n❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await sqlite.close();
    await pg.close();
    console.log('🔌 Database connections closed.');
  }
};

run();
