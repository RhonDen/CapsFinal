/*
  Seed fake HISTORY appointments and fake CONTACT messages.

  This seeds:
    1. Fake history appointments — only FINALIZED statuses
       (completed / notCompleted / rejected / cancelled).
       NOTE: NO 'pending' or 'accepted' statuses are used, so these records
       will NEVER appear as popups (Pending requests / Pending Outcome).
       They only show up in the History / Data Analysis / Clients pages.
    2. Fake contact messages for the admin Inbox.

  Usage:
    cd d:/React-Projects/capsproj/server
    node seed_fake_history_contacts.js

  It writes to whichever DB the app is configured to (SQLite local or
  Postgres/Neon). Existing fake rows (marked with notes starting with
  "[FAKE]") are purged first so re-running is idempotent.
*/

require('dotenv').config();

const { connectDatabase, disconnectDatabase } = require('./utils/database');
const { SERVICES } = require('./constants/services');
const Appointment = require('./models/Appointment');
const ContactMessage = require('./models/ContactMessage');
const Counter = require('./models/Counter');

const {
  pad2,
  addDays,
  pick,
  randInt,
  buildScheduled,
  getServiceDurationMinutes,
  dateKeyFromLocalDate,
  lastDaysWindow,
} = require('./utils/parkDemoSeed');

const FILIPINO_FIRST_NAMES = [
  'Juan', 'Maria', 'Jose', 'Rosa', 'Andres', 'Cristina', 'Miguel', 'Luz',
  'Ramon', 'Angela', 'Rico', 'Lani', 'Paolo', 'Gina', 'Marco', 'Divina',
  'Noel', 'Aileen', 'Vicente', 'Mylene', 'Rafael', 'Shiela', 'Dennis',
  'Jocelyn', 'Jerome', 'Marites', 'Fernando', 'Cecilia', 'Eduardo', 'Lorna',
  'Christopher', 'Analyn', 'Ernesto', 'Rachelle', 'Roderick', 'Imelda',
  'Christian', 'Grace', 'Dante', 'Rowena', 'Allan', 'Evelyn', 'Antonio',
  'Carol', 'Rogelio', 'Ma. Teresa', 'Ferdinand', 'Angelica', 'Renato', 'Kathleen'
];

const FILIPINO_LAST_NAMES = [
  'Santos', 'Reyes', 'Cruz', 'Bautista', 'Ocampo', 'Dela Cruz', 'Garcia',
  'Mendoza', 'Torres', 'Flores', 'Ramos', 'Rivera', 'Aquino', 'Domingo',
  'Villanueva', 'Gonzales', 'Castillo', 'Fernandez', 'Navarro', 'Salazar',
  'Lopez', 'Pascual', 'Marquez', 'Suarez', 'Contreras', 'Diaz', 'Valdez',
  'Tan', 'Lim', 'Chua', 'Uy', 'Co', 'Perez', 'Hernandez', 'Soriano',
  'Manalo', 'Dizon', 'Rosario', 'Barba', 'Serrano', 'Velasco', 'Agustin'
];

const FILIPINO_MIDDLE = ['', '', 'D.', 'R.', 'S.', 'B.', 'M.', 'P.'];

const GLOBE_PREFIXES = ['0817','0904','0905','0906','0915','0916','0917','0926','0927','0935','0936','0945','0953','0954','0955','0956','0965','0966','0967','0975','0976','0977','0978','0979','0994','0995','0996','0997'];
const SMART_PREFIXES = ['0813','0907','0908','0909','0910','0911','0912','0913','0914','0918','0919','0920','0921','0922','0923','0924','0925','0928','0929','0930','0931','0938','0939','0940','0942','0943','0946','0947','0948','0949','0950','0951','0960','0961','0962','0963','0968','0969','0970','0981','0989','0998','0999'];
const DITO_PREFIXES = ['0895','0896','0897','0898','0991','0992','0993','0994'];

function generatePhMobile() {
  const provider = Math.random();
  let prefix;
  if (provider < 0.45) prefix = pick(GLOBE_PREFIXES);
  else if (provider < 0.9) prefix = pick(SMART_PREFIXES);
  else prefix = pick(DITO_PREFIXES);
  const suffix = String(randInt(0, 9999999)).padStart(7, '0');
  return `0${prefix}${suffix}`;
}

function minutesToTime(totalMinutes) {
  return `${pad2(Math.floor(totalMinutes / 60))}:${pad2(totalMinutes % 60)}`;
}

const CONTACT_NAMES = [
  'Maria Santos', 'Juan Dela Cruz', 'Angela Reyes', 'Paolo Mendoza',
  'Cristina Garcia', 'Miguel Torres', 'Lani Flores', 'Rico Aquino',
  'Gina Ramos', 'Marco Villanueva', 'Shiela Rivera', 'Dennis Navarro'
];

const CONTACT_EMAILS = [
  'maria.santos@gmail.com', 'juan.delacruz@yahoo.com', 'angela.reyes@gmail.com',
  'paolo.mendoza@gmail.com', 'cristina.garcia@yahoo.com', 'miguel.torres@gmail.com',
  'lani.flores@gmail.com', 'rico.aquino@yahoo.com', 'gina.ramos@gmail.com',
  'marco.villanueva@gmail.com', 'shiela.rivera@yahoo.com', 'dennis.navarro@gmail.com'
];

const CONTACT_MESSAGES = [
  'Good day! I would like to ask if you accept HMO coverage for dental procedures like tooth extraction. Thank you!',
  'Hi, I want to book an appointment for my mother. She needs a check-up. What are your available schedules this week?',
  'Do you offer teeth whitening services? How much does it cost? Also, how long does the procedure take?',
  'I would like to inquire about braces. My son needs orthodontic treatment. Do you have payment terms?',
  'Hello, I had a tooth filling last week but I am experiencing some sensitivity. Can I schedule a follow-up?',
  'Good afternoon! Is the clinic open on Saturdays? I work on weekdays and can only visit on weekends.',
  'I want to ask about your dental cleaning package. Do you have promos for students?',
  'Hi, I lost my appointment confirmation. Can you resend the details? My name is listed in your system.',
  'Do you accept walk-in patients? I have a toothache and need urgent care.',
  'Good day! I would like to know if you do root canal treatments and how much the estimate would be.',
  'Hello, I need to reschedule my appointment next week. Is there an available slot this Friday?',
  'I am interested in getting dental implants. Can you provide more information about the procedure?'
];

/**
 * Seeds fake HISTORY appointments and fake CONTACT messages.
 *
 * @param {object} options
 * @param {boolean} [options.manageConnection=true]
 *   When true, connects/disconnects the DB (CLI usage).
 *   When false, assumes the server already has an open connection (startup usage).
 * @param {number} [options.total=60]  Number of fake history appointments (clamped 30-75).
 * @param {number} [options.contactTotal=12]  Number of fake contact messages (clamped 5-12).
 * @returns {Promise<object>} Summary of what was seeded.
 */
async function seedFakeHistoryContacts({
  manageConnection = true,
  total: requestedTotal,
  contactTotal: requestedContactTotal,
} = {}) {
  const { Op } = require('sequelize');

  if (manageConnection) await connectDatabase();

  try {
    // ── 1. Purge previous fake history rows ──────────────────────────────────
    const purgedAppointments = await Appointment.destroy({
      where: { notes: { [Op.like]: '[FAKE]%' } },
    });
    console.log(`Purged ${purgedAppointments} previous fake appointment(s).`);

    // Purge previous fake contact messages (seeded by this script)
    const purgedContacts = await ContactMessage.destroy({
      where: { email: { [Op.like]: '%@example.com' } },
    });
    console.log(`Purged ${purgedContacts} previous fake contact message(s).`);

    // ── 2. Seed fake HISTORY appointments ────────────────────────────────────
    const total = Math.min(75, Math.max(30, Number(requestedTotal || process.env.SEED_FAKE_HISTORY_TOTAL || 60)));
    const today = new Date();

    // Fake history is intentionally limited to MAY of the current year only.
    // Build a May 1 – May 31 window, but cap the end at YESTERDAY (23:59:59.999)
    // so no fake record ever lands on today or a future date. This guarantees
    // fake appointments never appear in the Dashboard's "Upcoming appointments"
    // / "Pending requests" / "Pending outcome" popups.
    const currentYear = today.getFullYear();
    const windowStart = new Date(currentYear, 4, 1, 0, 0, 0, 0); // May 1 (month index 4)
    const mayEnd = new Date(currentYear, 4, 31, 23, 59, 59, 999); // May 31
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);
    const windowEnd = mayEnd > yesterday ? yesterday : mayEnd;

    // Only FINALIZED statuses — no 'pending' or 'accepted' so these never
    // appear in Pending requests / Pending Outcome popups.
    const historyStatuses = [
      'completed', 'completed', 'completed', 'completed', 'completed',
      'completed', 'completed', 'completed', 'completed',
      'notCompleted', 'notCompleted', 'notCompleted', 'notCompleted', 'notCompleted',
      'rejected', 'rejected', 'rejected', 'rejected',
      'cancelled', 'cancelled'
    ];

    const services = Array.isArray(SERVICES) && SERVICES.length ? SERVICES : [
      'Regular Checkup - 30 min',
      'Teeth Cleaning - 45 min',
      'Tooth Filling - 40 min',
    ];

    const { BUSINESS_START_HOUR, BUSINESS_END_HOUR, SLOT_INTERVAL_MINUTES } = require('./utils/schedule');
    const startMin = BUSINESS_START_HOUR * 60;
    const endMin = BUSINESS_END_HOUR * 60;
    const maxStart = endMin - SLOT_INTERVAL_MINUTES;

    // Compute a safe serial-number base so fake records never collide with real ones.
    const counterId = 'appointmentSerial';
    const serialCounter = await Counter.findByPk(counterId);
    const maxSerial = await Appointment.max('serialNumber');
    const serialBase = Math.max(serialCounter ? serialCounter.seq : 0, maxSerial || 0);

    const appointments = [];
    for (let i = 0; i < total; i++) {
      const dayOffset = randInt(0, Math.floor((windowEnd - windowStart) / 86400000));
      const d = new Date(windowStart.getTime() + dayOffset * 86400000);
      if (d.getDay() === 0) {
        d.setDate(d.getDate() + 1);
        if (d > windowEnd) d.setDate(d.getDate() - 2);
      }

      const dateKey = dateKeyFromLocalDate(d);
      const slotMinutes = randInt(startMin, maxStart);
      const time = minutesToTime(slotMinutes);
      const scheduledStart = buildScheduled(dateKey, time);
      const service = pick(services);
      const durationMinutes = getServiceDurationMinutes(service);
      const scheduledEnd = new Date(scheduledStart.getTime() + durationMinutes * 60 * 1000);

      const status = pick(historyStatuses);
      const isWalkIn = Math.random() < 0.9;

      const firstName = pick(FILIPINO_FIRST_NAMES);
      const lastName = pick(FILIPINO_LAST_NAMES);
      const middleInitial = pick(FILIPINO_MIDDLE);
      const mobile = generatePhMobile();

      const reuseMobile = appointments.length > 0 && Math.random() < 0.25
        ? pick(appointments).number
        : mobile;

      const createdAt = new Date(scheduledStart.getTime() - randInt(12, 30) * 60 * 1000);
      const updatedAt = status === 'completed' || status === 'notCompleted'
        ? new Date(scheduledEnd.getTime() + randInt(5, 45) * 60 * 1000)
        : new Date(scheduledStart.getTime() + randInt(1, 10) * 60 * 1000);

      appointments.push({
        serialNumber: serialBase + i + 1,
        number: reuseMobile,
        lastName,
        firstName,
        middleInitial: middleInitial || '',
        service,
        email: `${firstName.toLowerCase().replace(/[^a-z0-9]/g, '')}.${lastName.toLowerCase().replace(/[^a-z0-9]/g, '')}${randInt(1, 999)}@example.com`,
        notes: `[FAKE] History demo ${i + 1}`,
        date: new Date(dateKey + 'T00:00:00'),
        dateKey,
        time,
        durationMinutes,
        scheduledStart,
        scheduledEnd,
        status,
        otp: null,
        otpExpires: null,
        verifiedAt: scheduledStart,
        isWalkIn,
        historyOtp: null,
        historyOtpExpires: null,
        createdAt,
        updatedAt,
      });
    }

    await Appointment.bulkCreate(appointments);

    const counter = await Counter.findByPk(counterId);
    if (!counter) {
      await Counter.create({ id: counterId, seq: serialBase + total + 1 });
    } else {
      await counter.update({ seq: Math.max(counter.seq, serialBase + total + 1) });
    }

    console.log(`Seeded ${appointments.length} fake history appointments.`);

    // ── 3. Seed fake CONTACT messages ────────────────────────────────────────
    const contactTotal = Math.min(12, Math.max(5, Number(requestedContactTotal || process.env.SEED_FAKE_CONTACTS_TOTAL || 12)));
    const contactMessages = [];

    for (let i = 0; i < contactTotal; i++) {
      const name = CONTACT_NAMES[i % CONTACT_NAMES.length];
      const email = CONTACT_EMAILS[i % CONTACT_EMAILS.length];
      const message = CONTACT_MESSAGES[i % CONTACT_MESSAGES.length];
      const createdAt = addDays(today, -randInt(0, 14));

      contactMessages.push({
        name,
        email,
        message,
        read: Math.random() < 0.4, // ~40% already read, rest unread for the badge
        ipAddress: '',
        createdAt,
        updatedAt: createdAt,
      });
    }

    await ContactMessage.bulkCreate(contactMessages);
    console.log(`Seeded ${contactMessages.length} fake contact messages.`);

    const fromLabel = dateKeyFromLocalDate(windowStart);
    const toLabel = dateKeyFromLocalDate(windowEnd);
    console.log(`Fake history window: ${fromLabel} to ${toLabel}`);
    console.log('Done. Fake history and contacts seeded successfully.');

    return {
      appointments: appointments.length,
      contacts: contactMessages.length,
      from: fromLabel,
      to: toLabel,
    };
  } finally {
    if (manageConnection) await disconnectDatabase();
  }
}

// CLI entry point — run directly with `node seed_fake_history_contacts.js`
if (require.main === module) {
  seedFakeHistoryContacts()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

module.exports = { seedFakeHistoryContacts };
