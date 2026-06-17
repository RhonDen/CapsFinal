const Counter = require('../models/Counter');

async function getNextSerialNumber(sequenceName) {
  const [counter, created] = await Counter.findOrCreate({
    where: { id: sequenceName },
    defaults: { seq: 0 },
  });

  counter.seq += 1;
  await counter.save();

  return counter.seq;
}

module.exports = {
  getNextSerialNumber,
};
