const { writePool, readPool } = require('../../db/connection');
const uuid = require('../../utils/uuid');
const { generateToken } = require('../../utils/auth');
const encrypt = require('../../utils/hash');
const errors = require('../../utils/errors');
const { validatePassword } = require('../../utils/validatePassword');
const { checkValueExists } = require('../../utils/checkEmail');
const { authenticate } = require('../../utils/authenticate');

// -------------------- HELPER FUNCTIONS --------------------
const formatDate = (date) => {
  if (!date) return null;
  const d = new Date(date);
  return d.toISOString().split('T')[0]; // Returns YYYY-MM-DD format
};

const getUserById = async (admin_id) => {
  const sql = `
    SELECT 
      a.admin_id,
      a.admin_name,
      a.admin_email,
      a.admin_status,
      a.admin_img,
      a.created_at,
      a.updated_at,
      r.role_id,
      r.role_name 
    FROM Admins a 
    JOIN Roles r ON a.role_id = r.role_id
    WHERE a.admin_id = ?
  `;
  const [results] = await readPool.query(sql, [admin_id]);
  return results[0] || null;
};

// -------------------- FETCH ALL USERS --------------------
const fetchAllUser = async (req, res, next) => {
  try {
    const { status, role_id } = req.query;
    
    let sql = `
      SELECT 
        a.admin_id,
        a.admin_name,
        a.admin_email,
        a.admin_status,
        a.admin_img,
        a.created_at,
        a.updated_at,
        r.role_id,
        r.role_name 
      FROM Admins a 
      JOIN Roles r ON a.role_id = r.role_id
    `;
    
    const params = [];
    
    // Add filters if provided
    const conditions = [];
    if (status) {
      conditions.push('a.admin_status = ?');
      params.push(status);
    }
    if (role_id) {
      conditions.push('a.role_id = ?');
      params.push(role_id);
    }
    
    if (conditions.length) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    sql += ' ORDER BY a.created_at DESC';

    const [results] = await readPool.query(sql, params);

    const formattedResults = results.map(user => ({
      ...user,
      created_at: formatDate(user.created_at),
      updated_at: formatDate(user.updated_at),
    }));

    return res.status(200).json({
      status: 200,
      message: 'Successfully fetched users',
      data: formattedResults,
    });

  } catch (error) {
    console.error('Fetch users error:', error.message);
    return next({ status: 500, message: 'Internal server error' });
  }
};

// -------------------- FETCH SINGLE USER --------------------
const fetchUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await getUserById(id);
    
    if (!user) {
      return res.status(404).json({
        status: 404,
        message: 'User not found',
      });
    }

    return res.status(200).json({
      status: 200,
      message: 'Successfully fetched user',
      data: {
        ...user,
        created_at: formatDate(user.created_at),
        updated_at: formatDate(user.updated_at),
      },
    });
  } catch (error) {
    console.error('Fetch user error:', error.message);
    return next({ status: 500, message: 'Internal server error' });
  }
};

// -------------------- SIGN IN USER --------------------
const signIn = async (req, res, next) => {
  const { admin_email, admin_password } = req.body;

  try {
    if (!admin_email || !admin_password) {
      return res.status(400).json({
        status: 400,
        message: 'Email and password are required',
      });
    }

    const result = await authenticate({
      tableName: 'Admins',
      emailField: 'admin_email',
      emailValue: admin_email,
      password: admin_password,
      passwordField: 'admin_password',
      statusField: 'admin_status',
      returnFields: ['admin_id', 'role_id', 'admin_password', 'admin_email', 'admin_status', 'admin_name'],
      customValidation: (user) => {
        if (!user.role_id) {
          return { valid: false, message: 'User role not assigned' };
        }
        return { valid: true };
      },
    });

    if (!result.success) {
      return res.status(result.error.status).json({
        status: result.error.status,
        message: result.error.message,
      });
    }

    const user = result.user;
    const token = generateToken({
      id: user.admin_id,
      role: user.role_id,
      system: process.env.JWT_SECRET_ADMIN,
      project: process.env.PROJECT_TAG,
    });

    const encrypted = encrypt.encrypt(JSON.stringify(user));

    return res.status(200).json({
      status: 200,
      message: 'Successfully signed in',
      token,
      data: encrypted,
    });
  } catch (error) {
    console.error('Sign in error:', error.message);
    return errors.mapError(500, 'Internal server error', next);
  }
};

// -------------------- CREATE USER --------------------
const createUser = async (req, res, next) => {
  try {
    const { role_id, admin_name, admin_email, admin_password } = req.body;

    if (!role_id || !admin_name || !admin_email || !admin_password) {
      return res.status(400).json({
        status: 400,
        message: 'All fields (role_id, admin_name, admin_email, admin_password) are required',
      });
    }

    const emailExists = await checkValueExists(admin_email, 'Admins', 'admin_email');
    if (emailExists) {
      return res.status(409).json({
        status: 409,
        message: 'Email already exists',
      });
    }

    const admin_img = req.file ? `/Uploads/adminUser/${req.file.filename}` : '/images/avatar.jpg';
    const admin_id = uuid.generatesUUID();

    const validate = validatePassword(admin_password);
    if (validate === 'too short') {
      return res.status(400).json({
        status: 400,
        message: 'The password must be at least 8 characters',
      });
    }

    if (validate === 'invalid') {
      return res.status(400).json({
        status: 400,
        message: 'Your password must include at least one lowercase letter, number, symbol, or uppercase letter',
      });
    }

    const hashedPassword = await encrypt.hashPassword(admin_password);
    await createUserInDB(admin_id, role_id, admin_name, admin_email, hashedPassword, admin_img);

    res.status(201).json({
      status: 201,
      message: 'User created successfully',
      password_strength: validate,
      data: { admin_id, role_id, admin_name, admin_email, admin_img },
    });
  } catch (error) {
    console.error('Create user error:', error.message);
    return errors.mapError(500, 'Internal server error', next);
  }
};

// -------------------- UPDATE USER --------------------
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role_id, admin_name, admin_status } = req.body;

    // Check if user exists
    const user = await getUserById(id);
    if (!user) {
      return res.status(404).json({
        status: 404,
        message: 'User not found',
      });
    }

    // Prepare update fields
    const updateFields = [];
    const params = [];
    
    if (role_id) {
      updateFields.push('role_id = ?');
      params.push(role_id);
    }
    
    if (admin_name) {
      updateFields.push('admin_name = ?');
      params.push(admin_name);
    }
    
    if (admin_status !== undefined) {
      updateFields.push('admin_status = ?');
      params.push(admin_status);
    }
    
    // Handle image update if file is uploaded
    if (req.file) {
      updateFields.push('admin_img = ?');
      params.push(`/Uploads/adminUser/${req.file.filename}`);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        status: 400,
        message: 'No valid fields provided for update',
      });
    }

    params.push(id); // Add id for WHERE clause

    const sql = `
      UPDATE Admins 
      SET ${updateFields.join(', ')} 
      WHERE admin_id = ?
    `;

    await writePool.query(sql, params);

    // Get updated user data
    const updatedUser = await getUserById(id);

    return res.status(200).json({
      status: 200,
      message: 'User updated successfully',
      data: {
        ...updatedUser,
        created_at: formatDate(updatedUser.created_at),
        updated_at: formatDate(updatedUser.updated_at),
      },
    });

  } catch (error) {
    console.error('Update user error:', error.message);
    return errors.mapError(500, 'Internal server error', next);
  }
};

// -------------------- DELETE USER --------------------
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const user = await getUserById(id);
    if (!user) {
      return res.status(404).json({
        status: 404,
        message: 'User not found',
      });
    }

    // Soft delete (update status) or hard delete
    const sql = 'DELETE FROM Admins WHERE admin_id = ?';
    await writePool.query(sql, [id]);

    return res.status(200).json({
      status: 200,
      message: 'User deleted successfully',
    });

  } catch (error) {
    console.error('Delete user error:', error.message);
    return errors.mapError(500, 'Internal server error', next);
  }
};

// -------------------- INSERT USER INTO DATABASE --------------------
const createUserInDB = (admin_id, role_id, admin_name, admin_email, hashedPassword, admin_img) => {
  return new Promise(async (resolve, reject) => {
    try {
      const sql = `
        INSERT INTO Admins (
          admin_id, role_id, admin_name, admin_email, admin_password, admin_img
        ) VALUES (?, ?, ?, ?, ?, ?)`;
      await writePool.query(sql, [admin_id, role_id, admin_name, admin_email, hashedPassword, admin_img]);
      resolve();
    } catch (error) {
      console.error('DB Error:', error);
      reject(error);
    }
  });
};

module.exports = {
  signIn,
  createUser,
  fetchAllUser,
  fetchUserById,
  updateUser,
  deleteUser
};