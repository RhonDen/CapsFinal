const { DataTypes } = require('sequelize');
const { sequelize } = require('../utils/database');

const ContactMessage = sequelize.define(
  'ContactMessage',
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(150), allowNull: false },
    email: { type: DataTypes.STRING(255), allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    ipAddress: { type: DataTypes.STRING(100), allowNull: true },
  },
  { tableName: 'ContactMessages', timestamps: true }
);

module.exports = ContactMessage;
