const fs = require('fs').promises;
const path = require('path');
const { writePool, readPool } = require('../db/connection');
const uuid = require('../utils/uuid');
const { validatePassword } = require('../utils/validatePassword');
const { checkValueExists } = require('../utils/checkEmail');
const { hashPassword, encrypt, comparePassword } = require('../utils/hash');
const { generateToken } = require('../utils/auth');
const errors = require('../utils/errors');

// Configuration constants
const ALLOWED_TABLES = {
  Admins: ['admin_id', 'email', 'username'],
  Users: [
    'user_id',
    'phone',
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

const DEFAULT_AVATAR = '/images/avatar.jpg';
const UPLOAD_DIR = '/uploads/photoUser/';

// Helper functions
function generateNames(data, gender = null) {
  return {
    firstName: data.user_first || 'DefaultFirst',
    lastName: data.user_last || 'DefaultLast'
  };
}

async function validatePhoneNumber(phone) {
  if (!phone) throw new Error('Phone number is required');
  if (!/^\+?\d{10,15}$/.test(phone)) {
    throw new Error('Invalid phone format (10-15 digits, optionally starting with +)');
  }
  const exists = await checkValueExists(phone, 'Users', 'phone');
  if (exists) throw new Error('Phone number already registered');
}

async function validateAndFormatBirthDate(dateString) {
  if (!dateString) return null;
  
  let dateObj;
  try {
    if (dateString.includes('-')) {
      const parts = dateString.split('-');
      dateObj = parts[0].length === 4 ? 
        new Date(dateString) : 
        new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    } else if (dateString.includes('/')) {
      const parts = dateString.split('/');
      dateObj = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    } else {
      dateObj = new Date(dateString);
    }

    if (!(dateObj instanceof Date) || isNaN(dateObj)) {
      throw new Error('Invalid date');
    }
    
    return dateObj.toISOString().split('T')[0];
  } catch (error) {
    throw new Error('Invalid birth date format. Use DD-MM-YYYY, YYYY-MM-DD, or DD/MM/YYYY');
  }
}

async function createUserData(data) {
  return {
    user_id: uuid(),
    phone: data.phone,
    user_first: data.user_first,
    user_last: data.user_last,
    user_birth_date: data.user_birth_date,
    user_gender: data.user_gender || null,
    user_country: data.user_country || null,
    user_password: data.user_password,
    user_status: 'active',
    user_img: data.user_img || DEFAULT_AVATAR
  };
}

async function insertUser(userData) {
  const fields = Object.keys(userData);
  const values = Object.values(userData);
  await writePool.query(
    `INSERT INTO Users (${fields.join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`,
    values
  );
}

async function generateRegistrationResponse(userData) {
  const token = await generateToken({ user_id: userData.user_id });
  return {
    status: 201,
    success: true,
    data: {
      user_id: userData.user_id,
      phone: userData.phone,
      user_first: userData.user_first,
      user_last: userData.user_last,
      user_img: userData.user_img,
      token
    }
  };
}

function formatPasswordError(validationResult) {
  return {
    status: 400,
    success: false,
    error: 'INVALID_PASSWORD',
    message: validationResult
  };
}

function handleRegistrationError(res, error) {
  if (error.message.includes('Phone number already registered')) {
    return res.status(409).json({
      status: 409,
      success: false,
      error: 'PHONE_EXISTS',
      message: error.message
    });
  }
  return res.status(500).json({
    status: 500,
    success: false,
    error: 'SERVER_ERROR',
    message: 'Internal server error'
  });
}

async function deleteUserImage(imagePath) {
  if (!imagePath || imagePath.includes(DEFAULT_AVATAR)) return false;
  
  try {
    const fullPath = path.join(__dirname, '..', '..', 'public', imagePath);
    await fs.unlink(fullPath);
    return true;
  } catch (error) {
    console.warn('Failed to delete user image:', error.message);
    return false;
  }
}

async function updateUserField(table, idColumn, idValue, column, newValue, checkDuplicate = true) {
  if (!ALLOWED_TABLES[table] || !ALLOWED_TABLES[table].includes(column)) {
    throw new Error(`Invalid table or column: ${table}.${column}`);
  }

  if (checkDuplicate) {
    const exists = await checkValueExists(newValue, table, column);
    if (exists) throw new Error(`${column} value already exists`);
  }

  const [rows] = await readPool.query(`SELECT 1 FROM ?? WHERE ?? = ?`, [table, idColumn, idValue]);
  if (rows.length === 0) {
    throw new Error('User not found');
  }

  const [result] = await writePool.query(
    'UPDATE ?? SET ?? = ? WHERE ?? = ?',
    [table, column, newValue, idColumn, idValue]
  );

  if (result.affectedRows === 0) {
    throw new Error('No changes made (value already set)');
  }

  return true;
}

function handleUpdateError(res, error) {
  if (error.message.includes('already exists')) {
    return res.status(409).json({
      success: false,
      message: error.message
    });
  }
  if (error.message === 'User not found') {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }
  if (error.message === 'No changes made (value already set)') {
    return res.status(400).json({
      success: false,
      message: 'No changes made (value already set)'
    });
  }
  return res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
}

// Helper function to get user by phone
async function getUserByPhone(phone) {
  const [rows] = await readPool.query(
    'SELECT user_id, phone, user_first, user_last, user_password, user_status, user_img FROM Users WHERE phone = ?',
    [phone]
  );
  
  return rows.length > 0 ? rows[0] : null;
}

// Helper function to format sign-in response
function generateSignInResponse(userData) {
  return {
    status: 200,
    success: true,
    message: 'Sign in successful',
    data: {
      user_id: userData.user_id,
      phone: userData.phone,
      user_first: userData.user_first,
      user_last: userData.user_last,
      user_img: userData.user_img,
      token: userData.token
    }
  };
}

// Helper function to handle sign-in errors
function handleSignInError(res, error) {
  if (error.message === 'INVALID_CREDENTIALS') {
    return res.status(401).json({
      status: 401,
      success: false,
      error: 'INVALID_CREDENTIALS',
      message: 'Invalid phone number or password'
    });
  }
  
  if (error.message === 'ACCOUNT_INACTIVE') {
    return res.status(403).json({
      status: 403,
      success: false,
      error: 'ACCOUNT_INACTIVE',
      message: 'Account is not active. Please contact support.'
    });
  }
  
  if (error.message === 'USER_NOT_FOUND') {
    return res.status(404).json({
      status: 404,
      success: false,
      error: 'USER_NOT_FOUND',
      message: 'User not found'
    });
  }
  
  return res.status(500).json({
    status: 500,
    success: false,
    error: 'SERVER_ERROR',
    message: 'Internal server error'
  });
}

// Controller functions
const registerUser = async (req, res) => {
  try {
    const { phone, user_password, user_birth_date, user_gender, user_country } = req.body;
    
    if (!phone || !user_password) {
      return res.status(400).json({
        status: 400,
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Phone and password are required'
      });
    }

    await validatePhoneNumber(phone);

    const { firstName, lastName } = generateNames(req.body, user_gender);

    const passwordValidation = validatePassword(user_password);
    if (passwordValidation !== 'valid') {
      return res.status(400).json(formatPasswordError(passwordValidation));
    }

    const formattedBirthDate = await validateAndFormatBirthDate(user_birth_date);

    const userData = await createUserData({
      ...req.body,
      user_first: firstName,
      user_last: lastName,
      user_birth_date: formattedBirthDate,
      user_password: await hashPassword(user_password),
      user_img: req.file ? `${UPLOAD_DIR}${req.file.filename}` : DEFAULT_AVATAR
    });

    await insertUser(userData);

    const response = await generateRegistrationResponse(userData);
    return res.status(201).json(response);

  } catch (error) {
    console.error('Registration error:', error);
    return handleRegistrationError(res, error);
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || id.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    const [users] = await readPool.query(
      'SELECT user_id, user_img FROM Users WHERE user_id = ?',
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];
    const imageDeleted = await deleteUserImage(user.user_img);

    const [result] = await writePool.query(
      'DELETE FROM Users WHERE user_id = ?',
      [id]
    );

    return res.status(200).json({
      success: true,
      affectedRows: result.affectedRows,
      userId: id,
      imageDeleted
    });

  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const updateUser = async (req, res) => {
  try {
    // Try extracting from body first
    let { data_type, id_value, value } = req.body;

    // Fallback to query parameters, mapping user_id to id_value and phone to value
    if (!data_type || !id_value || !value) {
      data_type = req.query.data_type;
      id_value = req.query.user_id || req.query.id_value;
      value = req.query.phone || req.query.value;
    }

    if (!data_type || !id_value || !value) {
      console.log('Missing fields:', { data_type, id_value, value, body: req.body, query: req.query });
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: data_type, id_value, value'
      });
    }

    if (!ALLOWED_TABLES.Users.includes(data_type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid update field: ${data_type}`
      });
    }

    if (data_type === 'phone') {
      await validatePhoneNumber(value);
    }

    console.log('Updating user:', { id_value, data_type, value });
    const updated = await updateUserField(
      'Users',
      'user_id',
      id_value,
      data_type,
      value,
      data_type === 'phone'
    );

    return res.status(200).json({
      success: true,
      message: `${data_type} updated successfully`,
      [data_type]: value
    });

  } catch (error) {
    console.error('Update user error:', error);
    return handleUpdateError(res, error);
  }
};

// Main sign-in controller function
const signInUser = async (req, res) => {
  try {
    const { phone, password } = req.body;
    
    // Validate required fields
    if (!phone || !password) {
      return res.status(400).json({
        status: 400,
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Phone and password are required'
      });
    }

    // Validate phone format
    if (!/^\+?\d{10,15}$/.test(phone)) {
      return res.status(400).json({
        status: 400,
        success: false,
        error: 'INVALID_PHONE_FORMAT',
        message: 'Invalid phone format (10-15 digits, optionally starting with +)'
      });
    }

    // Get user by phone
    const user = await getUserByPhone(phone);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    // Check if user status is active
    if (user.user_status !== 'active') {
      throw new Error('ACCOUNT_INACTIVE');
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.user_password);
    if (!isPasswordValid) {
      throw new Error('INVALID_CREDENTIALS');
    }

    // Generate token for authenticated user
    const token = await generateToken({ user_id: user.user_id });

    // Prepare response data
    const responseData = {
      ...user,
      token
    };

    // Generate and send successful response
    const response = generateSignInResponse(responseData);
    return res.status(200).json(response);

  } catch (error) {
    console.error('Sign in error:', error);
    return handleSignInError(res, error);
  }
};

const updateValueExists = async (table, idColumn, idValue, column, newValue, checkDuplicate = true) => {
  try {
    if (!ALLOWED_TABLES[table]) {
      throw new Error(`Invalid table: ${table}`);
    }
    if (!ALLOWED_TABLES[table].includes(column) && column !== idColumn) {
      throw new Error(`Invalid column: ${column} for table: ${table}`);
    }

    if (checkDuplicate) {
      const exists = await checkValueExists(newValue, table, column);
      if (exists) {
        throw new Error(`${column} already exists`);
      }
    }

    const [rows] = await readPool.query(`SELECT 1 FROM ?? WHERE ?? = ?`, [table, idColumn, idValue]);
    if (rows.length === 0) {
      throw new Error('User not found');
    }

    const sql = `UPDATE ?? SET ?? = ? WHERE ?? = ?`;
    const [result] = await writePool.query(sql, [table, column, newValue, idColumn, idValue]);

    if (result.affectedRows === 0) {
      throw new Error('No changes made (value already set)');
    }

    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error in updateValueExists:', error.message);
    throw error;
  }
};

module.exports = {
  registerUser,
  deleteUser,
  updateUser,
  updateValueExists,
  signInUser
};