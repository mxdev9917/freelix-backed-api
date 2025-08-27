const { v4: uuidv4 } = require('uuid');

module.exports = () => {
  const uuid = uuidv4();
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14); // YYYYMMDDHHmmss
  return `${timestamp}-${uuid}`;
};
