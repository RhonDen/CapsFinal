require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('mongo-sanitize');
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

// Strip Mongo operators from incoming payloads to reduce NoSQL injection risk.
app.use((req, res, next) => {
  req.body = mongoSanitize(req.body);
  req.query = mongoSanitize(req.query);
  req.params = mongoSanitize(req.params);
  next();
});

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

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(clientDistPath));

  // SPA fallback: serve index.html for all non-API routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
      if (err) next();
    });
  });
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


    console.log(
      database.mode === 'sqlite'
        ? `Connected to SQLite at ${database.uri}`
        : `Connected to MySQL at ${database.uri}`
    );

    const port = Number(process.env.PORT) || 5000;
    const server = app.listen(port, () => {

      console.log(`Server running on port ${port}`);
      console.log(`Serving React from: ${clientDistPath}`);
    });

    // In dev, keep behavior predictable.
    // If the port is already in use, fail fast so you don't end up with a "random" setup.
    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Stop the previous dev server and restart.`);
      }
      throw err;
    });


  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

startServer();
