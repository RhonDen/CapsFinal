const { DataTypes } = require('sequelize');
const { sequelize } = require('../utils/database');

const Admin = sequelize.define(
  'Admin',
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    username: { type: DataTypes.STRING, allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING, allowNull: false },
  },
  { tableName: 'Admins' }
);

module.exports = Admin;
