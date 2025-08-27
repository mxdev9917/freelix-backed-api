require('dotenv').config();
const jwt = require('jsonwebtoken');

function generateToken({ id, role, system }) {
  const secrets = {
    admin:"admin",
    app:"app",
  };

  const secret = secrets[system];
  if (!secret) throw new Error('Invalid system');

  const payload = {
    id,
    role,
    system, // 'adminsystem' or 'shopsystem'
    project: process.env.PROJECT_TAG,
  };

  return jwt.sign(payload, secret, { expiresIn: '1d' });
}


function generateTokenApp({ id, role, system }) {
  const secrets = {
    admin: "admin",
    app: "app",
  };

  const secret = secrets[system];
  if (!secret) throw new Error('Invalid system');

  const payload = {
    id,
    role,
    system,
    project: process.env.PROJECT_TAG,
  };

  return jwt.sign(payload, secret, { expiresIn: '1d' });
}

module.exports = { generateToken ,generateTokenApp};
