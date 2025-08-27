const { uploadFile } = require('../../minIo/storageMinIoController');

async function validateWorkType(work_type) {
  const validWorkTypes = ['full-time', 'part-time'];
  if (!validWorkTypes.includes(work_type)) {
    throw new Error('work_type must be one of: full-time, part-time');
  }
  return true;
}

async function portfolioFile(file) {
  try {
    if (file) return await uploadFile('portfolio', file);
    return process.env.DEFAULT_PATH || 'default/path';
  } catch (err) {
    console.error('Portfolio upload error:', err.message);
    return process.env.DEFAULT_PATH || 'default/path';
  }
}

async function bankFile(file) {
  try {
    if (file) return await uploadFile('banks', file);
    return process.env.DEFAULT_PATH || 'default/path';
  } catch (err) {
    console.error('Bank upload error:', err.message);
    return process.env.DEFAULT_PATH || 'default/path';
  }
}

async function personalFile(file) {
  try {
    if (file) return await uploadFile('personalid', file);
    return process.env.DEFAULT_PATH || 'default/path';
  } catch (err) {
    console.error('Personal ID upload error:', err.message);
    return process.env.DEFAULT_PATH || 'default/path';
  }
}

async function passportFile(file) {
  try {
    if (file) return await uploadFile('passports', file);
    return process.env.DEFAULT_PATH || 'default/path';
  } catch (err) {
    console.error('Passport upload error:', err.message);
    return process.env.DEFAULT_PATH || 'default/path';
  }
}

module.exports = {
  validateWorkType,
  portfolioFile,
  bankFile,
  personalFile,
  passportFile
};
