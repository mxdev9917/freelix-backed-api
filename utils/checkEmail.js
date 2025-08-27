const { readPool } = require('../db/connection');

const allowedTables = ['Admins', 'Users'];

exports.checkValueExists = async (value, table, column) => {
  try {
    // Validate inputs
    if (!value || !table || !column) {
      throw new Error('Value, table, and column are required');
    }

    if (!allowedTables.includes(table)) {
      throw new Error(`Invalid table name: ${table}. Allowed tables: ${allowedTables.join(', ')}`);
    }

    if (typeof value !== 'string' || typeof table !== 'string' || typeof column !== 'string') {
      throw new Error('Invalid input types: value, table, and column must be strings');
    }

    // Trim and sanitize value to prevent issues with whitespace
    const sanitizedValue = value.trim();

    // Use backticks for table and column names to handle reserved words
    const sql = `SELECT \`${column}\` FROM \`${table}\` WHERE \`${column}\` = ? LIMIT 1`;
    const [results] = await readPool.query(sql, [sanitizedValue]);

    return results.length > 0;
  } catch (error) {
    console.error('Error in checkValueExists:', {
      message: error.message,
      sqlMessage: error.sqlMessage || 'N/A',
      sqlState: error.sqlState || 'N/A',
      code: error.code || 'N/A',
      value,
      table,
      column,
    });
    throw error; // Re-throw to be handled by the caller
  }
};