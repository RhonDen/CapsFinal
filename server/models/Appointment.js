const { DataTypes } = require('sequelize');
const { sequelize } = require('../utils/database');

// Each record represents a booking request or an accepted walk-in record.
const Appointment = sequelize.define(
  'Appointment',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    serialNumber: { type: DataTypes.INTEGER, unique: true, allowNull: true },
    number: { type: DataTypes.STRING, allowNull: false },
    lastName: { type: DataTypes.STRING, allowNull: false },
    firstName: { type: DataTypes.STRING, allowNull: false },
    middleInitial: { type: DataTypes.STRING, allowNull: true },
    service: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: true },
    date: { type: DataTypes.DATE, allowNull: true },
    dateKey: { type: DataTypes.STRING, allowNull: true },
    time: { type: DataTypes.STRING, allowNull: true },
    durationMinutes: { type: DataTypes.INTEGER, allowNull: true },
    scheduledStart: { type: DataTypes.DATE, allowNull: true },
    scheduledEnd: { type: DataTypes.DATE, allowNull: true },
    status: {
      type: DataTypes.ENUM('pending', 'accepted', 'rejected', 'completed', 'notCompleted'),
      defaultValue: 'pending',
    },
    otp: { type: DataTypes.STRING, allowNull: true },
    otpExpires: { type: DataTypes.DATE, allowNull: true },
    verifiedAt: { type: DataTypes.DATE, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    isWalkIn: { type: DataTypes.BOOLEAN, defaultValue: false },
    historyOtp: { type: DataTypes.STRING, allowNull: true },
    historyOtpExpires: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: 'Appointments',
  }
);

module.exports = Appointment;
