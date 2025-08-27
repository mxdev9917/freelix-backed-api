import fs from "fs/promises";
import multer from "multer";
import path from "path";
import jwt from "jsonwebtoken";
import stream from "stream"; // Node's stream module

import { writePool, readPool } from "../../db/connection.js";
import uuid from "../../utils/uuid.js";
import { validatePassword } from "../../utils/validatePassword.js";
import { checkValueExists } from "../../utils/checkEmail.js";
import * as encryptUtil from "../../utils/encrypt.js";
import { generateTokenApp } from "../../utils/auth.js";
import * as errors from "../../utils/errors.js";

import {
  uploadFile,
  getFileByName,
  getFileUrl,
  replaceImage,
  fileExists,
  deleteFileByName
} from "../minIo/storageMinIoController.js";



const updateUserImage = async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    if (!user_id) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    // 1. Find user in DB
    const [users] = await readPool.query(
      "SELECT user_id, user_img FROM Users WHERE user_id = ?",
      [user_id]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const user = users[0];
    let fileName;

    // 2. Check if existing image is in MinIO
    if (user.user_img) {
      const fileExistsInMinIO = await fileExists("users", user.user_img);

      if (fileExistsInMinIO) {
        console.log("Replacing existing image:", user.user_img);

        // Replace existing image
        const result = await replaceImage(
          "users",
          user.user_img, // keep same filename
          req.file.buffer,
          req.file.mimetype
        );

        if (!result.success) {
          console.error("Replace image failed:", result.message);
          return res.status(500).json({ success: false, message: result.message });
        }

        fileName = user.user_img;
      } else {
        console.log("Existing image not found in MinIO, uploading new file");
        fileName = await uploadFile(req.file, "users");
      }
    } else {
      console.log("User has no previous image, uploading new file");
      fileName = await uploadFile(req.file, "users");
    }

    // 3. Update DB
    await writePool.query("UPDATE Users SET user_img = ? WHERE user_id = ?", [
      fileName,
      user_id,
    ]);

    return res.json({
      success: true,
      message: "User image updated successfully",
      filename: fileName,
    });
  } catch (error) {
    console.error("updateUserImage error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

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
function generateNames(data) {
  return {
    firstName: data.user_first || 'DefaultFirst',
    lastName: data.user_last || 'DefaultLast'
  };
}

async function validatePhoneNumber(phone) {
  if (!phone) throw new Error('Phone number is required');

  // Clean and format phone number
  const cleanedPhone = phone.replace(/\D/g, ''); // Remove non-digit characters

  if (!/^\d{10,15}$/.test(cleanedPhone)) {
    throw new Error('Invalid phone format (10-15 digits required)');
  }

  // Check if phone exists with exact match
  const [rows] = await readPool.query(
    'SELECT user_id FROM Users WHERE phone = ? LIMIT 1',
    [cleanedPhone]
  );

  if (rows.length > 0) {
    throw new Error('Phone number already registered');
  }
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

    // Check if birth date is reasonable (not in future and not too old)
    const now = new Date();
    const minDate = new Date(now.getFullYear() - 120, now.getMonth(), now.getDate()); // 120 years ago
    const maxDate = new Date(now.getFullYear() - 13, now.getMonth(), now.getDate()); // 13 years ago (minimum age)

    if (dateObj > now) {
      throw new Error('Birth date cannot be in the future');
    }

    if (dateObj < minDate) {
      throw new Error('Birth date seems unrealistic');
    }

    if (dateObj > maxDate) {
      throw new Error('You must be at least 13 years old to register');
    }

    return dateObj.toISOString().split('T')[0];
  } catch {
    throw new Error('Invalid birth date format. Use DD-MM-YYYY, YYYY-MM-DD, or DD/MM/YYYY');
  }
}

async function createUserData(data) {
  // Clean phone number by removing non-digit characters
  const cleanedPhone = data.phone.replace(/\D/g, '');

  return {
    user_id: uuid(),
    phone: cleanedPhone,
    user_first: data.user_first,
    user_last: data.user_last,
    user_birth_date: data.user_birth_date,
    user_gender: data.user_gender,
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

function formatPasswordError(validationResult) {
  return {
    status: 400,
    success: false,
    error: 'INVALID_PASSWORD',
    message: validationResult
  };
}

function handleRegistrationError(res, error) {
  console.error('Registration error details:', error.message);

  if (error.message.includes('Phone number already registered')) {
    return res.status(409).json({
      status: 409,
      success: false,
      error: 'PHONE_EXISTS',
      message: 'This phone number is already registered. Please use a different number or try signing in.'
    });
  }

  if (error.message.includes('Invalid phone format')) {
    return res.status(400).json({
      status: 400,
      success: false,
      error: 'INVALID_PHONE',
      message: 'Please enter a valid phone number (10-15 digits)'
    });
  }

  if (error.message.includes('Birth date')) {
    return res.status(400).json({
      status: 400,
      success: false,
      error: 'INVALID_BIRTH_DATE',
      message: error.message
    });
  }

  if (error.message.includes('Invalid system')) {
    return res.status(500).json({
      status: 500,
      success: false,
      error: 'TOKEN_GENERATION_ERROR',
      message: 'Token generation failed'
    });
  }

  // Handle database unique constraint errors
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      status: 409,
      success: false,
      error: 'DUPLICATE_ENTRY',
      message: 'This phone number is already registered'
    });
  }

  return res.status(500).json({
    status: 500,
    success: false,
    error: 'SERVER_ERROR',
    message: 'Internal server error: ' + error.message
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

async function updateUserFieldDB(table, idColumn, idValue, column, newValue, checkDuplicate = true) {
  if (!ALLOWED_TABLES[table] || !ALLOWED_TABLES[table].includes(column)) {
    throw new Error(`Invalid table or column: ${table}.${column}`);
  }

  if (checkDuplicate && column === 'phone') {
    const cleanedPhone = newValue.replace(/\D/g, '');
    const [rows] = await readPool.query(
      'SELECT user_id FROM Users WHERE phone = ? AND user_id != ? LIMIT 1',
      [cleanedPhone, idValue]
    );
    if (rows.length > 0) throw new Error('Phone number already exists');
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
    return res.status(409).json({ success: false, message: error.message });
  }
  if (error.message === 'User not found') {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  if (error.message === 'No changes made (value already set)') {
    return res.status(400).json({ success: false, message: 'No changes made (value already set)' });
  }
  return res.status(500).json({ success: false, message: 'Internal server error' });
}

// -------------------- Controller functions --------------------
const registerUser = async (req, res) => {
  try {
    const { phone, user_password, user_birth_date } = req.body;
    if (!phone || !user_password) {
      return res.status(400).json({
        status: 400,
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Phone and password are required'
      });
    }

    // Validate phone number first
    await validatePhoneNumber(phone);

    const { firstName, lastName } = generateNames(req.body);

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
      user_password: await encryptUtil.hashPassword(user_password),
      user_img: req.file ? `${UPLOAD_DIR}${req.file.filename}` : DEFAULT_AVATAR
    });

    await insertUser(userData);

    const token = generateTokenApp({
      id: userData.user_id,
      role: 'user',
      system: 'app',
      project: process.env.PROJECT_TAG,
    });

    const encryptedData = encryptUtil.encrypt(JSON.stringify({
      user_id: userData.user_id,
      phone: userData.phone,
      user_first: userData.user_first,
      user_last: userData.user_last,
      user_birth_date: userData.user_birth_date,
      user_gender: userData.user_gender,
      user_country: userData.user_country,
      user_status: userData.user_status,
      user_img: userData.user_img,
    }));

    return res.status(200).json({
      status: 200,
      message: 'Successfully signed in',
      token,
      data: encryptedData,
    });

  } catch (error) {
    console.error('Registration error:', error);
    return handleRegistrationError(res, error);
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!id || typeof id !== "string" || id.trim().length < 10) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid user ID format" 
      });
    }

    // Check if user exists
    const [users] = await readPool.query(
      "SELECT user_id, user_img FROM Users WHERE user_id = ?",
      [id]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    const user = users[0];

    // Delete image if exists
    let imageDeleted = false;
    if (user.user_img) {
      try {
        imageDeleted = await deleteUserImage("users",user.user_img);
      } catch (imgErr) {
        console.warn("User image delete failed:", imgErr);
      }
    }

    // Delete user
    const [result] = await writePool.query(
      "DELETE FROM Users WHERE user_id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(500).json({ 
        success: false, 
        message: "Failed to delete user" 
      });
    }

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
      userId: id,
      affectedRows: result.affectedRows,
      imageDeleted
    });

  } catch (error) {
    console.error("Delete user error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
};



const updateUser = async (req, res) => {
  try {
    let { data_type, id_value, value } = req.body;
    console.log({ data_type, id_value, value })
    if (!data_type || !id_value || !value) {
      data_type = req.query.data_type;
      id_value = req.query.user_id || req.query.id_value;
      value = req.query.phone || req.query.val
    }

    if (!data_type || !id_value || !value) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: data_type, id_value, value'
      });
    }

    if (!ALLOWED_TABLES.Users.includes(data_type)) {
      return res.status(400).json({ success: false, message: `Invalid update field: ${data_type}` });
    }

    if (data_type === 'phone') {
      await validatePhoneNumber(value);
    }

    await updateUserFieldDB('Users', 'user_id', id_value, data_type, value, data_type === 'phone');

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



const updateValueExists = async (table, idColumn, idValue, column, newValue, checkDuplicate = true) => {
  try {
    if (!ALLOWED_TABLES[table]) throw new Error(`Invalid table: ${table}`);
    if (!ALLOWED_TABLES[table].includes(column) && column !== idColumn) {
      throw new Error(`Invalid column: ${column} for table: ${table}`);
    }

    if (checkDuplicate) {
      const exists = await checkValueExists(newValue, table, column);
      if (exists) throw new Error(`${column} already exists`);
    }

    const [rows] = await readPool.query('SELECT 1 FROM ?? WHERE ?? = ?', [table, idColumn, idValue]);
    if (rows.length === 0) throw new Error('User not found');

    const [result] = await writePool.query(
      'UPDATE ?? SET ?? = ? WHERE ?? = ?',
      [table, column, newValue, idColumn, idValue]
    );

    if (result.affectedRows === 0) throw new Error('No changes made (value already set)');

    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error in updateValueExists:', error.message);
    throw error;
  }
};

const signInUser = async (req, res) => {
  const { phone, password } = req.body;

  try {
    if (!phone || !password) {
      return res.status(400).json({ status: 400, message: 'Phone number and password are required' });
    }

    // Clean phone number for search
    const cleanedPhone = phone.replace(/\D/g, '');

    const [rows] = await readPool.query('SELECT * FROM Users WHERE phone = ? LIMIT 1', [cleanedPhone]);

    if (rows.length === 0) {
      return res.status(404).json({ status: 404, message: 'User not found' });
    }

    const user = rows[0];

    if (user.user_status === 'pending') {
      return res.status(403).json({ status: 403, message: 'Your account is pending approval' });
    }
    if (user.user_status === 'blocked') {
      return res.status(403).json({ status: 403, message: 'Your account is blocked' });
    }

    const isMatch = await encryptUtil.comparePassword(password, user.user_password);
    if (!isMatch) {
      return res.status(401).json({ status: 401, message: 'Invalid phone number or password' });
    }

    const token = generateTokenApp({
      id: user.user_id,
      role: 'user',
      system: 'app',
      project: process.env.PROJECT_TAG,
    });

    const encryptedData = encryptUtil.encrypt(JSON.stringify({
      user_id: user.user_id,
      phone: user.phone,
      user_first: user.user_first,
      user_last: user.user_last,
      user_birth_date: user.user_birth_date,
      user_gender: user.user_gender,
      user_country: user.user_country,
      user_status: user.user_status,
      user_img: user.user_img,
    }));

    return res.status(200).json({
      status: 200,
      message: 'Successfully signed in',
      token,
      data: encryptedData,
    });

  } catch (error) {
    console.error('Sign in by phone error:', error.message);
    return res.status(500).json({ status: 500, message: 'Internal server error' });
  }
};
const updateUserName = async (req, res, next) => {
  try {
    const { user_first, user_last, user_id } = req.body;

    // Validate input
    if (!user_first || !user_last || !user_id) {
      return res.status(400).json({
        success: false,
        message: 'user_first, user_last, and user_id are required',
      });
    }

    // Run update query
    const [result] = await writePool.query(
      `UPDATE Users 
       SET user_first = ?, user_last = ? 
       WHERE user_id = ?`,
      [user_first, user_last, user_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.json({
      success: true,
      message: 'User updated successfully',
    });
  } catch (error) {
    console.error('update user name and last error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};


export {
  signInUser,
  registerUser,
  deleteUser,
  updateUser,
  updateValueExists,
  updateUserName,
  updateUserImage
};
