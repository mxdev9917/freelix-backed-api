const {  writePool } = require('../db/connection');

const allowedTables = {
  'Admins': ['admin_id', 'email', 'username'],
  'Users': [
    'user_id',
    'phone',  // Added this
    'user_first',
    'user_last',
    'user_birth_date',
    'user_gender',
    'user_country',
    'user_password',
    'user_status',
    'user_img'
  ]
};
/**
 * Updates a column value for a specific row by ID
 * @param {string} table - The table name
 * @param {string} idColumn - The ID column name
 * @param {string} idValue - The ID value
 * @param {string} column - The column name to update
 * @param {string} newValue - The new value to set
 * @param {boolean} checkDuplicate - Whether to check for duplicate before updating
 */
exports.updateValueExists = async (table, idColumn, idValue, column, newValue, checkDuplicate = true) => {
  try {
    // Validate table and column
    if (!allowedTables[table]) {
      throw new Error(`Invalid table: ${table}`);
    }
    if (!allowedTables[table].includes(column) && column !== idColumn) {
      throw new Error(`Invalid column: ${column} for table: ${table}`);
    }

    // Optional: check for duplicate
    if (checkDuplicate) {
      const exists = await updateValueExists(newValue, table, column);
      if (exists) {
        throw new Error(`${column} already exists`);
      }
    }

    // Run update query
    const sql = `UPDATE ?? SET ?? = ? WHERE ?? = ?`;
    const [result] = await writePool.query(sql, [table, column, newValue, idColumn, idValue]);

    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error in updateValueById:', error.message);
    throw error;
  }
};
