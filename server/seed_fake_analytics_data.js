/*
  Seed fake analytics data for admin dashboard.

  Inserts fake Appointments (status: accepted/rejected/completed/notCompleted/pending)
  so /api/admin/dashboard and /api/admin/analytics have meaningful charts.

  Usage:
    1) Ensure DB_DIALECT=mysql and DB_* env vars are set (the script uses server/utils/database.js).
    2) Run:
         cd d:/React-Projects/capsproj/server
         node seed_fake_analytics_data.js

  Notes:
  - This uses the app's Sequelize models (from utils/database.js), so it writes to
    whichever DB your app is configured to (SQLite or MySQL).
  - It sets `otp` to null so appointments show up in analytics and clients lists.
  - Appointment fields are generated to fall within business hours (09:00-17:00) and 15-min slots.
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
  BUSINESS_START_HOUR,
  BUSINESS_END_HOUR,
  SLOT_INTERVAL_MINUTES,
  dateKeyFromDateValue,
} = require('./utils/schedule');

function pad2(v) {
  return String(v).padStart(2, '0');
}

function minutesToTime(totalMinutes) {
  return `${pad2(Math.floor(totalMinutes / 60))}:${pad2(totalMinutes % 60)}`;
}

function addDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildScheduled(dateKey, time) {
  const [y, m, day] = dateKey.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const scheduledStart = new Date(y, m - 1, day, hh, mm, 0, 0);
  return scheduledStart;
}

function getServiceDurationMinutes(service) {
  const m = String(service).match(/(\d+)\s*min/i);
  if (!m) return 30;
  return Number.parseInt(m[1], 10);
}

function formatTimeForDateKey(scheduledStart) {
  return `${pad2(scheduledStart.getHours())}:${pad2(scheduledStart.getMinutes())}`;
}

async function main() {
  const total = Number(process.env.SEED_FAKE_APPOINTMENTS_TOTAL || 50);
  const daysBack = Number(process.env.SEED_FAKE_APPOINTMENTS_DAYS_BACK || 20);

  // By default, this seed should NOT run and create fake data.
  // To generate fake appointments, set SEED_FAKE_APPOINTMENTS_ENABLED=true.
  const enabled = String(process.env.SEED_FAKE_APPOINTMENTS_ENABLED || '').toLowerCase() === 'true';

  // If true, we only purge already-seeded fakes and exit (no new inserts).
  const purgeOnly = String(process.env.SEED_FAKE_APPOINTMENTS_PURGE_ONLY || '').toLowerCase() === 'true';

  // Ensure DB connection + model registration
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

  // Optional: add a few blocked dates (keeps admin UI interesting)
  const doBlockedDates = String(process.env.SEED_FAKE_BLOCKED_DATES || 'true') === 'true';
  if (doBlockedDates) {
    // Create 3 blocked dates within the daysBack window
    for (let i = 0; i < 3; i++) {
      const d = addDays(new Date(), -randInt(0, daysBack));
      const dateKey = dateKeyFromDateValue(d);
      if (!dateKey) continue;

      const normalized = new Date(`${dateKey}T00:00:00.000Z`);
      // store as local date object; Sequelize/DB may interpret timezone, but for dashboard it uses dateKey primarily.
      await BlockedDate.findOrCreate({
        where: { date: normalized },
        defaults: { date: normalized, reason: 'Demo blocked date' },
      });
    }
  }

  // Insert fake appointments
  const statuses = ['pending', 'accepted', 'rejected', 'completed', 'notCompleted'];
  const statusWeights = {
    pending: 0.25,
    accepted: 0.25,
    rejected: 0.15,
    completed: 0.2,
    notCompleted: 0.15,
  };

  const services = Array.isArray(SERVICES) && SERVICES.length ? SERVICES : [
    'Routine Dental Checkup - 30 min',
    'Professional Teeth Cleaning - 45 min',
    'Tooth Filling Consultation - 40 min',
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

  // Remove existing fake-ish appointments.
  // Only delete the ones created by the seed: notes starting with '[FAKE]'
  const { Op } = require('sequelize');
  await Appointment.destroy({ where: { notes: { [Op.like]: '[FAKE]%' } } });

  if (purgeOnly) {
    console.log('Purged fake appointments only (notes starting with [FAKE]).');
    return;
  }

  if (!enabled) {
    console.log('SEED_FAKE_APPOINTMENTS_ENABLED is not true; skipping fake appointment seeding.');
    return;
  }

  const firstNames = ['John', 'Maria', 'Ali', 'Sara', 'David', 'Layla', 'Omar', 'Nina', 'Chen', 'Priya'];
  const lastNames = ['Smith', 'Garcia', 'Hassan', 'Nguyen', 'Brown', 'Khan', 'Patel', 'Kim', 'Martin', 'Wilson'];
  const middle = ['A', 'B', 'C', 'D', '', ''];

  const appointments = [];

  const startMin = BUSINESS_START_HOUR * 60;
  const endMin = BUSINESS_END_HOUR * 60;

  for (let i = 0; i < total; i++) {
    const dayOffset = randInt(0, daysBack);
    const d = addDays(new Date(), -dayOffset);
    const dateKey = dateKeyFromDateValue(d);
    if (!dateKey) continue;

    // pick a slot
    const maxStart = endMin - SLOT_INTERVAL_MINUTES;
    const slotMinutes = randInt(startMin, maxStart);
    const slot = minutesToTime(slotMinutes);

    const scheduledStart = buildScheduled(dateKey, slot);
    const service = pick(services);
    const durationMinutes = getServiceDurationMinutes(service);
    const scheduledEnd = new Date(scheduledStart.getTime() + durationMinutes * 60 * 1000);

    const status = weightedStatus();

    // Ensure analytics includes items: analytics uses otp=null.
    const otp = null;

    const time = slot;
    const number = `09${randInt(100000000, 999999999)}`; // 09 + 9 digits => 11 digits

    const firstName = pick(firstNames);
    const lastName = pick(lastNames);
    const middleInitial = pick(middle);

    // Align status with business meaning
    // - pending: canApprove relies on !otp and hasSchedule; in UI pending+no otp show approve/reject
    // - accepted/rejected: dashboard counts as todayAppointments statuses.
    // - completed/notCompleted: dashboard expects canMarkOutcome depending on scheduledStart <= now.
    // We'll still set scheduledStart/end so outcome works.

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

  // Bulk insert (let Sequelize/Mysql assign ids)
  await Appointment.bulkCreate(appointments);

  // Update counter (optional)
  const counterId = 'appointmentSerial';
  const counter = await Counter.findByPk(counterId);
  if (!counter) {
    await Counter.create({ id: counterId, seq: appointments.length + 1 });
  } else {
    await counter.update({ seq: counter.seq + appointments.length + 1 });
  }

  console.log(`Seeded ${appointments.length} fake appointments.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

