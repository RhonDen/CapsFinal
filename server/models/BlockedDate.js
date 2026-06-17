const { DataTypes } = require('sequelize');
const { sequelize } = require('../utils/database');

const BlockedDate = sequelize.define(
  'BlockedDate',
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    date: { type: DataTypes.DATE, allowNull: false, unique: true },
    reason: { type: DataTypes.STRING, allowNull: true },
  },
  { tableName: 'BlockedDates' }
);

module.exports = BlockedDate;
