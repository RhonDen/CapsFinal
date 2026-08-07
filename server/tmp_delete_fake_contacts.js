const { connectDatabase, disconnectDatabase } = require('./utils/database');
const ContactMessage = require('./models/ContactMessage');
const { Op } = require('sequelize');

(async () => {
  await connectDatabase();
  const count = await ContactMessage.count({ where: { email: { [Op.like]: '%@example.com' } } });
  console.log('Fake contact messages before delete:', count);
  const deleted = await ContactMessage.destroy({ where: { email: { [Op.like]: '%@example.com' } } });
  console.log('Deleted fake contact messages:', deleted);
  const remaining = await ContactMessage.count({ where: { email: { [Op.like]: '%@example.com' } } });
  console.log('Fake contact messages after delete:', remaining);
  await disconnectDatabase();
})();
