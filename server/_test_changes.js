/**
 * Quick verification test for PostgreSQL migration changes.
 * Run: node server/_test_changes.js
 */
const path = require('path');
const { Sequelize } = require('sequelize');

async function runTests() {
  let passed = 0;
  let failed = 0;
  const check = (name, ok, detail) => {
    if (ok) { console.log(`  ✅ ${name}`); passed++; }
    else { console.log(`  ❌ ${name}: ${detail}`); failed++; }
  };

  console.log('\n🔍 VERIFYING POSTGRESQL MIGRATION CHANGES\n');

  // Test 1: SQLite still works
  try {
    const sqlitePath = path.join(__dirname, 'database.sqlite');
    const sqlite = new Sequelize({ dialect: 'sqlite', storage: sqlitePath, logging: false });
    await sqlite.authenticate();
    await sqlite.close();
    check('SQLite connection works', true);
  } catch(e) {
    check('SQLite connection works', false, e.message);
  }

  // Test 2: pg module installed
  try {
    require('pg');
    check('pg module (PostgreSQL driver) installed', true);
  } catch(e) {
    check('pg module (PostgreSQL driver) installed', false, e.message);
  }

  // Test 3: database.js exports
  try {
    const db = require(path.join(__dirname, 'utils/database'));
    check('database.js exports correctly', !!(db.sequelize && db.connectDatabase && db.disconnectDatabase));
  } catch(e) {
    check('database.js exports correctly', false, e.message);
  }

  // Test 4: database.js has postgres dialect logic
  try {
    const fs = require('fs');
    const content = fs.readFileSync(path.join(__dirname, 'utils/database.js'), 'utf8');
    check('Has dialect === postgres branch', content.includes("dialect === 'postgres'"));
    check('Has POSTGRES_URI env var', content.includes('POSTGRES_URI'));
    check('Has SSL config for postgres', content.includes('ssl'));
    check('Has rejectUnauthorized: false', content.includes('rejectUnauthorized'));
  } catch(e) {
    check('database.js dialect logic', false, e.message);
  }

  // Test 5: server.js updated
  try {
    const fs = require('fs');
    const content = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
    check('server.js has postgres log line', content.includes("Connected to PostgreSQL"));
  } catch(e) {
    check('server.js updated', false, e.message);
  }

  // Test 6: Migration script exists and has correct structure
  try {
    const fs = require('fs');
    const content = fs.readFileSync(path.join(__dirname, '_migrate_to_postgres.js'), 'utf8');
    check('Migration script exists', true);
    check('Migrates Admins table', content.includes('Admins'));
    check('Migrates Appointments table', content.includes('Appointments'));
    check('Migrates BlockedDates', content.includes('BlockedDates'));
    check('Migrates ContactMessages', content.includes('ContactMessages'));
    check('Migrates Counters', content.includes('Counters'));
    check('Uses bulkCreate', content.includes('bulkCreate'));
    check('Has ignoreDuplicates', content.includes('ignoreDuplicates'));
    check('NEVER deletes SQLite data', content.includes('NEVER deleted'));
  } catch(e) {
    check('Migration script', false, e.message);
  }

  // Test 7: package.json has pg
  try {
    const pkg = require(path.join(__dirname, 'package.json'));
    check('pg in dependencies', !!(pkg.dependencies && pkg.dependencies.pg));
    check('sequelize version >= 6.37', (pkg.dependencies.sequelize || '').includes('6.37'));
  } catch(e) {
    check('package.json', false, e.message);
  }

  console.log(`\n📊 RESULTS: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
