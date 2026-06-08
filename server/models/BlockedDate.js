const mongoose = require('mongoose');

// Dates are normalized to midnight before saving so one calendar day maps to one record.
const blockedDateSchema = new mongoose.Schema({
  date: { type: Date, required: true, unique: true },
  reason: { type: String, default: '' },
});

module.exports = mongoose.model('BlockedDate', blockedDateSchema);
