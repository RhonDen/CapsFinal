const { DataTypes } = require('sequelize');
const { sequelize } = require('../utils/database');

const Counter = sequelize.define(
  'Counter',
  {
    id: { type: DataTypes.STRING, primaryKey: true, allowNull: false },
    seq: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  { tableName: 'Counters' }
);

module.exports = Counter;
