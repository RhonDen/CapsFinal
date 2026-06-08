const mongoose = require('mongoose');

// Each document represents a booking request or an accepted walk-in record.
const appointmentSchema = new mongoose.Schema({
  serialNumber: { type: Number, unique: true, sparse: true },
  number: { type: String, required: true },
  lastName: { type: String, required: true },
  firstName: { type: String, required: true },
  middleInitial: { type: String, default: '' },
  service: { type: String, required: true },
  email: { type: String, default: '' },
  date: { type: Date, default: Date.now },
  dateKey: { type: String, default: null, index: true },
  time: { type: String, default: null },
  durationMinutes: { type: Number, default: null },
  scheduledStart: { type: Date, default: null },
  scheduledEnd: { type: Date, default: null },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'completed', 'notCompleted'],
    default: 'pending',
  },
  otp: { type: String, default: null },
  otpExpires: { type: Date, default: null },
  verifiedAt: { type: Date, default: null },
  notes: { type: String, default: '' },
  isWalkIn: { type: Boolean, default: false },
  historyOtp: { type: String, default: null },
  historyOtpExpires: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Appointment', appointmentSchema);
