require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('mongo-sanitize');
const cookieParser = require('cookie-parser');
const { connectDatabase } = require('./utils/database');
const ensureDefaultAdmin = require('./utils/ensureDefaultAdmin');
const bookingsRoute = require('./routes/bookings');
const adminRoute = require('./routes/admin');

const app = express();

app.disable('x-powered-by');

// Add secure defaults for headers.
app.use(helmet());

// Only the configured frontend is allowed to use cookie-authenticated requests.
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
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

app.use('/api/bookings', bookingsRoute);
app.use('/api/admin', adminRoute);

app.use((error, req, res, next) => {
  void next;
  console.error('Unhandled server error:', error);
  res.status(500).json({ error: 'Internal server error.' });
});

// Start the API after the database connection is ready and the development admin is ensured.
const startServer = async () => {
  try {
    const database = await connectDatabase();
    await ensureDefaultAdmin();

    console.log(
      database.mode === 'memory'
        ? 'Connected to in-memory MongoDB for development.'
        : 'Connected to MongoDB.'
    );

    const port = process.env.PORT || 5000;
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

startServer();
