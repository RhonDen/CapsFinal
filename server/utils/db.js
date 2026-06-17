const { Sequelize, DataTypes, Op, QueryTypes } = require('sequelize');

const mysqlUri = process.env.MYSQL_URI;
const host = process.env.MYSQL_HOST || '127.0.0.1';
const port = process.env.MYSQL_PORT || '3306';
const database = process.env.MYSQL_DATABASE || 'capsproj';
const username = process.env.MYSQL_USER || 'root';
const password = process.env.MYSQL_PASSWORD || '';

const connectionString =
  mysqlUri ||
  `mysql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;

const sequelize = new Sequelize(connectionString, {
  dialect: 'mysql',
  dialectOptions: {
    decimalNumbers: true,
  },
  logging: false,
  define: {
    timestamps: false,
  },
});

module.exports = {
  sequelize,
  DataTypes,
  Op,
  QueryTypes,
};
