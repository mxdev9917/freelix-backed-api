const bcrypt = require('bcrypt');
const crypto = require('crypto');
const errors = require('./errors');


async function hashPassword(password) {
  try {
    return await bcrypt.hash(password, 10);
  } catch (error) {
    console.error(error.message);
    throw errors.mapError(500, "Internal server error");
  }
}

async function comparePassword(password, hash) {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.error(error.message);
    throw errors.mapError(500, "Internal server error");
  }
}





function encrypt(text) {
  const secretPassword = process.env.ENCRYPT_SECRET || 'default-password';
  const saltValue = process.env.ENCRYPT_SALT || 'default-salt';
  const iterations = 10000;
  const keyLength = 32;

  // Use PBKDF2 to match Dart implementation
  const key = crypto.pbkdf2Sync(
    secretPassword, 
    saltValue, 
    iterations, 
    keyLength, 
    'sha256'
  );

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  console.log('Generated key:', key.toString('hex'));
  console.log('Generated IV:', iv.toString('hex'));
  
  return {
    iv: iv.toString('hex'),
    encryptedData: encrypted,
  };
}

module.exports = {
  hashPassword,
  comparePassword,
  encrypt,
};
