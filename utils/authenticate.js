const { readPool } = require('../db/connection');
const encrypt = require('../utils/hash');

const allowedTables = ['Admins'];

/**
 * Authenticate user by table with custom fields.
 */
const authenticate = async (options) => {
  const {
    tableName,
    emailField,
    emailValue,
    password,
    passwordField = 'password',
    statusField = null,
    customValidation = null,
    returnFields = ['*'],
  } = options;

  try {
    console.log('Authentication request:', { 
      tableName, 
      emailField, 
      emailValue: emailValue.substring(0, 3) + '...', 
      passwordField,
      statusField
    });

    // Validate inputs
    if (!tableName || !emailField || !emailValue || !password) {
      console.log('Missing required fields');
      return {
        success: false,
        error: { status: 400, message: 'Missing required fields' },
      };
    }

    if (!allowedTables.includes(tableName)) {
      console.log('Invalid table name:', tableName);
      return {
        success: false,
        error: { status: 400, message: 'Invalid table name' },
      };
    }

    // Build and execute query
    const fields = returnFields.length > 0 ? returnFields.join(', ') : '*';
    const sql = `SELECT ${fields} FROM ${tableName} WHERE ${emailField} = ? LIMIT 1`;
    
    console.log('Executing SQL:', sql);
    const [results] = await readPool.query(sql, [emailValue]);

    if (results.length === 0) {
      console.log('No user found with email:', emailValue);
      return {
        success: false,
        error: { status: 401, message: 'Invalid credentials' },
      };
    }

    const user = results[0];
    console.log('User found:', { 
      id: user.admin_id,
      email: user.admin_email,
      role: user.role_id 
    });

    // Verify password
    if (!user[passwordField]) {
      console.log('Password field not found in user data');
      return {
        success: false,
        error: { status: 500, message: 'Password field not found' },
      };
    }

    console.log('Comparing passwords...');
    const isPasswordCorrect = await encrypt.comparePassword(password, user[passwordField]);
    if (!isPasswordCorrect) {
      console.log('Password comparison failed');
      return {
        success: false,
        error: { status: 401, message: 'Invalid credentials' },
      };
    }

    // Check account status
    if (statusField && user[statusField] === 0) {
      console.log('Account is inactive');
      return {
        success: false,
        error: { status: 403, message: 'Account is inactive' },
      };
    }

    // Custom validation
    if (typeof customValidation === 'function') {
      console.log('Running custom validation');
      const customResult = customValidation(user);
      if (!customResult.valid) {
        console.log('Custom validation failed:', customResult.message);
        return {
          success: false,
          error: { status: 403, message: customResult.message || 'Validation failed' },
        };
      }
    }

    console.log('Authentication successful for:', emailValue);
    return { success: true, user };

  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      error: { status: 500, message: 'Authentication error' },
    };
  }
};

module.exports = { authenticate };