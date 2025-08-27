require('dotenv').config();
const jwt = require('jsonwebtoken');
const { readPool } = require('../db/connection');

const secrets = {
  admin: process.env.JWT_SECRET_ADMIN,
  app: process.env.JWT_SECRET_APP,
};

/**
 * Fetches role_name from database using role_id
 * @param {string} roleId - The role_id from JWT token
 * @returns {Promise<string|null>} - Role name or null if not found
 */
async function getRoleName(roleId) {
  if (!roleId) {
    console.error('No roleId provided');
    return null;
  }

  try {
    const [results] = await readPool.query(
      `SELECT role_name FROM Roles WHERE role_id = ?`,
      [roleId]
    );
    
    if (!results.length) {
      console.error(`Role not found for role_id: ${roleId}`);
      return null;
    }
    
    return results[0].role_name;
  } catch (error) {
    console.error('Database error in getRoleName:', error);
    return null;
  }
}

/**
 * Enhanced JWT verification middleware with role validation
 * @param {string} system - 'admin' or 'app'
 * @param {string[]} allowedRoles - Allowed role_names
 * @returns {Function} - Express middleware function
 */
function verifyToken(system, allowedRoles = []) {
  return async (req, res, next) => {
    try {
      // 1. Verify Authorization Header
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ 
          success: false,
          message: 'Authorization header missing' 
        });
      }

      // 2. Extract Token
      const token = authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({ 
          success: false,
          message: 'Bearer token missing' 
        });
      }

      // 3. Get Secret Key
      const secret = secrets[system];
      if (!secret) {
        console.error(`Missing secret for system: ${system}`);
        return res.status(500).json({ 
          success: false,
          message: 'Server configuration error' 
        });
      }

      // 4. Verify JWT
      let decoded;
      try {
        decoded = jwt.verify(token, secret);
        console.log('Decoded Token:', decoded); // Debug logging
      } catch (jwtError) {
        console.error('JWT verification failed:', jwtError.message);
        return res.status(403).json({ 
          success: false,
          message: 'Invalid or expired token',
          error: jwtError.message 
        });
      }

      // 5. Validate System and Project
      if (decoded.system !== system || decoded.project !== process.env.PROJECT_TAG) {
        return res.status(403).json({ 
          success: false,
          message: 'Token not valid for this system' 
        });
      }

      // 6. Validate Role (updated to use 'role' instead of 'role_id')
      if (!decoded.role) {
        return res.status(403).json({ 
          success: false,
          message: 'Token missing role information' 
        });
      }

      const roleName = await getRoleName(decoded.role);
      if (!roleName) {
        return res.status(403).json({ 
          success: false,
          message: 'Invalid role assignment',
          details: `Role ID '${decoded.role}' not found in database`
        });
      }

      // 7. Check Role Permissions
      if (allowedRoles.length > 0 && !allowedRoles.includes(roleName)) {
        return res.status(403).json({ 
          success: false,
          message: 'Insufficient permissions',
          // requiredRoles: allowedRoles,
          // yourRole: roleName
        });
      }

      // 8. Attach User to Request
      req.user = {
        id: decoded.id,
        role: roleName,
        role_id: decoded.role, // Keeping original role ID
        system: decoded.system,
        project: decoded.project
      };

      // 9. Proceed to Next Middleware
      next();
    } catch (error) {
      console.error('Unexpected error in verifyToken:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Internal server error during authentication',
        error: error.message 
      });
    }
  };
}

module.exports = verifyToken;