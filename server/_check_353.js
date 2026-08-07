const { sequelize } = require('./utils/database');
const Appointment = require('./models/Appointment');

(async () => {
  try {
    const appt = await Appointment.findByPk(353);
    if (!appt) {
      console.log('Appointment 353 not found.');
      process.exit(1);
    }
    console.log('ID 353 status:', appt.status);
    console.log('isWalkIn:', appt.isWalkIn);
    console.log('scheduledEnd:', appt.scheduledEnd);
    console.log('scheduledStart:', appt.scheduledStart);
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
