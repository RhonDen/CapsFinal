/*
  Seed fake analytics data for admin dashboard.

  Modes:
  A) "Park Demo" (DEFAULT when SEED_PARK_MODE=true):
     - Seeds the most recent past April-May window (defaults computed from today).
     - Uses realistic Filipino names + real PH mobile prefixes (Globe/Smart/DITO).
     - ~90% walk-ins, otp=null (NO SMS / OTP is ever sent — direct DB insert only).
     - Status mix: completed ~45%, notCompleted ~25%, rejected ~20%,
       accepted ~7%, pending ~3%.
     - Default total = 70 (range 50-75). Set SEED_PARK_TOTAL to override.
     - createdAt/updatedAt are backdated to the scheduled date so records look
       genuinely historical to the admin charts.

  B) Legacy (existing behavior):
     - Seeds last N days with generic names. Enabled via
       SEED_FAKE_APPOINTMENTS_ENABLED=true.

  Usage (park demo):
     cd d:/React-Projects/capsproj/server
     node seed_fake_analytics_data.js

  It writes to whichever DB the app is configured to (SQLite local or Postgres/Neon).
  Set SEED_PARK_MODE=true to enable the park demo (the script refuses to run the
  park demo WITHOUT this flag so it can never clobber real data accidentally).

  Cleanup:
     node seed_fake_analytics_data.js  (with SEED_FAKE_APPOINTMENTS_PURGE_ONLY=true)
     deletes only rows whose notes start with [FAKE].
*/

require('dotenv').config();

const bcrypt = require('bcryptjs');

const { connectDatabase, disconnectDatabase } = require('./utils/database');
const { SERVICES } = require('./constants/services');

const Admin = require('./models/Admin');
const Appointment = require('./models/Appointment');
const BlockedDate = require('./models/BlockedDate');
const Counter = require('./models/Counter');

const {
  dateKeyFromDateValue,
} = require('./utils/schedule');

const {
  seedParkDemo,
  pad2,
  addDays,
  pick,
  randInt,
  buildScheduled,
  getServiceDurationMinutes,
} = require('./utils/parkDemoSeed');

function minutesToTime(totalMinutes) {
  return `${pad2(Math.floor(totalMinutes / 60))}:${pad2(totalMinutes % 60)}`;
}

async function main() {
  const totalDefault = Number(process.env.SEED_FAKE_APPOINTMENTS_TOTAL || 50);

  // ── Park demo mode ──────────────────────────────────────────────────────────
  const parkMode = String(process.env.SEED_PARK_MODE || '').toLowerCase() === 'true';
  const parkTotal = Math.min(75, Math.max(50, Number(process.env.SEED_PARK_TOTAL || 70)));

  await connectDatabase();

  // Ensure default admin exists (so login works during demos)
  const username = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
  const password = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
  const existingAdmin = await Admin.findOne({ where: { username } });
  if (!existingAdmin) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    await Admin.create({ username, passwordHash });
  }

  const { Op } = require('sequelize');

  // Always purge previous fake rows first (notes start with [FAKE])
  await Appointment.destroy({ where: { notes: { [Op.like]: '[FAKE]%' } } });

  const purgeOnly = String(process.env.SEED_FAKE_APPOINTMENTS_PURGE_ONLY || '').toLowerCase() === 'true';
  if (purgeOnly) {
    console.log('Purged fake appointments only (notes starting with [FAKE]).');
    await disconnectDatabase();
    return;
  }

  if (parkMode) {
    // Delegates to the shared parkDemoSeed utility.
    // manageConnection=false because this script already connected above.
    const result = await seedParkDemo({ total: parkTotal, manageConnection: false });
    console.log(`No SMS/OTP was sent — direct DB insert only (${result.walkIns} walk-ins, ${result.total - result.walkIns} online).`);
    await disconnectDatabase();
    return;
  }

  // ── Legacy mode (unchanged behavior) ────────────────────────────────────────
  const daysBack = Number(process.env.SEED_FAKE_APPOINTMENTS_DAYS_BACK || 20);
  const enabled = String(process.env.SEED_FAKE_APPOINTMENTS_ENABLED || '').toLowerCase() === 'true';

  if (!enabled) {
    console.log('SEED_FAKE_APPOINTMENTS_ENABLED is not true; skipping fake appointment seeding. (Use SEED_PARK_MODE=true for the park demo.)');
    await disconnectDatabase();
    return;
  }

  const doBlockedDates = String(process.env.SEED_FAKE_BLOCKED_DATES || 'true') === 'true';
  if (doBlockedDates) {
    for (let i = 0; i < 3; i++) {
      const d = addDays(new Date(), -randInt(0, daysBack));
      const dateKey = dateKeyFromDateValue(d);
      if (!dateKey) continue;
      const normalized = new Date(`${dateKey}T00:00:00.000Z`);
      await BlockedDate.findOrCreate({
        where: { date: normalized },
        defaults: { date: normalized, reason: 'Demo blocked date' },
      });
    }
  }

  const statuses = ['pending', 'accepted', 'rejected', 'completed', 'notCompleted'];
  const statusWeights = {
    pending: 0.25,
    accepted: 0.25,
    rejected: 0.15,
    completed: 0.2,
    notCompleted: 0.15,
  };

  const services = Array.isArray(SERVICES) && SERVICES.length ? SERVICES : [
    'Regular Checkup - 30 min',
    'Teeth Cleaning - 45 min',
    'Tooth Filling - 40 min',
  ];

  function weightedStatus() {
    const r = Math.random();
    let acc = 0;
    for (const s of statuses) {
      acc += statusWeights[s] || 0;
      if (r <= acc) return s;
    }
    return 'accepted';
  }

  console.log(`Legacy mode: seeding ~${totalDefault} appointments over the last ${daysBack} days.`);
  const appointments = [];

  const startMin = BUSINESS_START_HOUR * 60;
  const endMin = BUSINESS_END_HOUR * 60;
  const maxStart = endMin - SLOT_INTERVAL_MINUTES;

  for (let i = 0; i < totalDefault; i++) {
    const dayOffset = randInt(0, daysBack);
    const d = addDays(new Date(), -dayOffset);
    const dateKey = dateKeyFromDateValue(d);
    if (!dateKey) continue;

    const slotMinutes = randInt(startMin, maxStart);
    const time = minutesToTime(slotMinutes);
    const scheduledStart = buildScheduled(dateKey, time);
    const service = pick(services);
    const durationMinutes = getServiceDurationMinutes(service);
    const scheduledEnd = new Date(scheduledStart.getTime() + durationMinutes * 60 * 1000);

    const status = weightedStatus();
    const otp = null;
    const number = `09${randInt(100000000, 999999999)}`;

    const firstName = pick(['John', 'Maria', 'Ali', 'Sara', 'David', 'Layla', 'Omar', 'Nina', 'Chen', 'Priya']);
    const lastName = pick(['Smith', 'Garcia', 'Hassan', 'Nguyen', 'Brown', 'Khan', 'Patel', 'Kim', 'Martin', 'Wilson']);
    const middleInitial = pick(['A', 'B', 'C', 'D', '', '']);

    appointments.push({
      serialNumber: null,
      number,
      lastName,
      firstName,
      middleInitial: middleInitial || '',
      service,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randInt(1, 999)}@example.com`,
      notes: `[FAKE] Demo data ${i}`,
      date: new Date(dateKey + 'T00:00:00'),
      dateKey,
      time,
      durationMinutes,
      scheduledStart,
      scheduledEnd,
      status,
      otp,
      otpExpires: null,
      verifiedAt: scheduledStart,
      isWalkIn: Math.random() < 0.3,
      historyOtp: null,
      historyOtpExpires: null,
    });
  }

  await Appointment.bulkCreate(appointments);

  const counterId = 'appointmentSerial';
  const counter = await Counter.findByPk(counterId);
  if (!counter) {
    await Counter.create({ id: counterId, seq: appointments.length + 1 });
  } else {
    await counter.update({ seq: counter.seq + appointments.length + 1 });
  }

  console.log(`Seeded ${appointments.length} fake appointments.`);
  await disconnectDatabase();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
