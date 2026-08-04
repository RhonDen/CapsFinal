// Force PH timezone so all Date operations use Asia/Manila (UTC+8)
process.env.TZ = 'Asia/Manila';

require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { connectDatabase } = require('./utils/database');
// Note: `ensureDefaultAdmin` and route modules are required after DB
// initialization inside startServer to avoid circular model imports.
const app = express();

app.disable('x-powered-by');

// Add secure defaults for headers.
app.use(helmet());


// Only the configured frontend is allowed to use cookie-authenticated requests.
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(s => s.trim());
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      }
      // Also allow any *.vercel.app domain (wildcard)
      if (origin.endsWith('.vercel.app')) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many OTP requests. Please try again later.' },
});

app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// ── API Routes ─────────────────────────────────────────────────────
app.use('/api/bookings/request-otp', otpLimiter);
app.use('/api/bookings/history/request-otp', otpLimiter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Routes are registered after DB connects (see startServer)

/**
 * Serve React build (production only)
 * During development (npm run dev / concurrently), the React app is served by Vite
 * and calls the backend via the Vite proxy (/api -> http://localhost:5000).
 * Keeping the SPA serving enabled in dev can cause stale UI / mismatched behavior.
 */
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
const fs = require('fs');

// If the built dist folder exists, serve it (works in both dev & production)
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  // SPA fallback: serve index.html for all non-API routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
      if (err) next();
    });
  });

  console.log(`Serving React static files from: ${clientDistPath}`);
} else {
  console.log('No client/dist folder found. Run "npm run build" first for production mode, or use Vite dev server on port 5173.');
}

app.use((error, req, res, next) => {
  void next;
  console.error('Unhandled server error:', error);
  res.status(500).json({ error: 'Internal server error.' });
});

// Start the API after the database connection is ready and the development admin is ensured.
const startServer = async () => {
  try {
    const database = await connectDatabase();

    // Require and run ensureDefaultAdmin after DB connects so models are available.
    const ensureDefaultAdmin = require('./utils/ensureDefaultAdmin');
    await ensureDefaultAdmin();

    // Now require and register routes; requiring them earlier could cause models
    // to be imported before `sequelize` is initialized and leads to `null`.
    const bookingsRoute = require('./routes/bookings');
    const adminRoute = require('./routes/admin');
    const contactRoute = require('./routes/contact');
    const publicBlockedDatesRoute = require('./routes/publicBlockedDates');

    app.use('/api/bookings', bookingsRoute);
    app.use('/api/contact', contactRoute);
    app.use('/api/admin', adminRoute);
    app.use('/api/public', publicBlockedDatesRoute);

    // ── Purge any leftover fake/demo data on startup ────────────────────────
    // This removes any [FAKE] records that may have been seeded into the
    // production database by previous versions of the app. Runs once on
    // every server start so the deployed DB is always clean.
    const Appointment = require('./models/Appointment');
    const { Op } = require('sequelize');
    try {
      const purgedFake = await Appointment.destroy({
        where: { notes: { [Op.like]: '%FAKE%' } },
      });
      if (purgedFake > 0) {
        console.log(`Purged ${purgedFake} fake/demo appointment(s) from database.`);
      }
    } catch (purgeError) {
      console.error('Fake data purge error (non-fatal):', purgeError.message);
    }

    if (database.mode === 'sqlite') {
      console.log(`Connected to SQLite at ${database.uri}`);
    } else if (database.mode === 'postgres') {
      console.log('Connected to PostgreSQL (Vercel Postgres / Neon)');
    } else {
      console.log(`Connected to MySQL at ${database.uri}`);
    }

    const port = Number(process.env.PORT) || 5000;
    const server = app.listen(port, () => {
      console.log(`Server running on port ${port}`);
      console.log(`Serving React from: ${clientDistPath}`);
    });

    // ── Background job: auto-mark no-show online appointments ──────────────
    // Every 5 minutes, find online appointments (isWalkIn = false) that are
    // still 'accepted' but whose scheduled end time has passed, and mark them
    // as 'notCompleted'. Walk-ins are intentionally NOT auto-marked — they
    // remain visible in the dashboard's "Pending Outcome" section until the
    // admin manually marks them as completed or not completed.
    const autoMarkNoShowOnlineAppointments = async () => {
      try {
        const now = new Date();

        const overdueOnlineAppointments = await Appointment.findAll({
          where: {
            isWalkIn: false,
            status: 'accepted',
            scheduledEnd: { [Op.lt]: now },
          },
        });

        for (const appointment of overdueOnlineAppointments) {
          appointment.status = 'notCompleted';
          await appointment.save();
        }

        if (overdueOnlineAppointments.length > 0) {
          console.log(`Auto-marked ${overdueOnlineAppointments.length} no-show online appointment(s) as not completed.`);
        }
      } catch (error) {
        console.error('Auto-mark no-show online appointments error:', error.message);
      }
    };

    // Run once shortly after startup, then every 5 minutes.
    setTimeout(autoMarkNoShowOnlineAppointments, 10 * 1000);
    setInterval(autoMarkNoShowOnlineAppointments, 5 * 60 * 1000);

    // In dev, keep behavior predictable.
    // If the port is already in use, fail fast so you don't end up with a "random" setup.
    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Stop the previous dev server and restart.`);
      }
      throw err;
    });

  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

startServer();
