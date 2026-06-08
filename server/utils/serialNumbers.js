const Counter = require('../models/Counter');

async function getNextSerialNumber(sequenceName) {
  const counter = await Counter.findByIdAndUpdate(
    sequenceName,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return counter.seq;
}

module.exports = {
  getNextSerialNumber,
};
