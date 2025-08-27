const path = require('path');
const mysql = require('mysql2/promise');

// โหลด env จากไฟล์ config.env ใน root project
require('dotenv').config({ path: path.resolve(__dirname, '../config.env') });

console.log('Loaded DB_HOST_WRITE:', process.env.DB_HOST_WRITE);

const requiredEnvVars = [
  'DB_HOST_WRITE', 'DB_PORT_WRITE', 'DB_USER_WRITE', 'DB_PASSWORD_WRITE', 'DB_DATABASE_WRITE',
  'DB_HOST_READ', 'DB_PORT_READ', 'DB_USER_READ', 'DB_PASSWORD_READ', 'DB_DATABASE_READ'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

const writePool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST_WRITE,
  port: parseInt(process.env.DB_PORT_WRITE, 10) || 3306,
  user: process.env.DB_USER_WRITE,
  password: process.env.DB_PASSWORD_WRITE,
  database: process.env.DB_DATABASE_WRITE,
  connectTimeout: parseInt(process.env.DB_CONNECTTIMEOUT_WRITE, 10) || 10000,
  waitForConnections: true,
  queueLimit: 0,
  timezone: 'Z',
  charset: 'utf8mb4',
});

const readPool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST_READ,
  port: parseInt(process.env.DB_PORT_READ, 10) || 3306,
  user: process.env.DB_USER_READ,
  password: process.env.DB_PASSWORD_READ,
  database: process.env.DB_DATABASE_READ,
  connectTimeout: parseInt(process.env.DB_CONNECTTIMEOUT_READ, 10) || 10000,
  waitForConnections: true,
  queueLimit: 0,
  timezone: 'Z',
  charset: 'utf8mb4',
});

async function testConnections() {
  let writeConn, readConn;
  try {
    [writeConn, readConn] = await Promise.all([
      writePool.getConnection(),
      readPool.getConnection(),
    ]);
    console.log('✅ Connected to MySQL write database');
    console.log('✅ Connected to MySQL read database');

    await Promise.all([
      writeConn.query('SELECT 1'),
      readConn.query('SELECT 1'),
    ]);
  } catch (err) {
    console.error('❌ Database connection error:', err.message);
    throw err;
  } finally {
    if (writeConn) writeConn.release();
    if (readConn) readConn.release();
  }
}

async function closePools() {
  await Promise.all([writePool.end(), readPool.end()]);
  console.log('✅ Database pools closed');
}

module.exports = {
  writePool,
  readPool,
  testConnections,
  closePools,
};
