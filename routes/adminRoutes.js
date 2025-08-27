const express = require('express');
const adminRoutes = express.Router();
const multer = require('multer');

const middlewares = require('../middlewares/middleware');
const verifyToken = require('../middlewares/verifyToken');
const { createRole, fetchRole, fetchRoleById, updateRole, deleteRole } = require('../controllers/admincontroller/roleService');
const { signIn, createUser, fetchAllUser, fetchUserById, updateUser, deleteUser } = require('../controllers/admincontroller/userService');

// Multer configuration
const createUpload = require('../utils/multer');
const upload = createUpload('Uploads/adminUser', {
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.mimetype)) return cb(new Error('Only JPEG, PNG, and GIF files are allowed'));
    cb(null, true);
  },
});

// Multer error handler
const multerErrorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ status: 400, message: 'File size exceeds 5MB limit' });
    return res.status(400).json({ status: 400, message: err.message });
  }
  if (err.message === 'Only JPEG, PNG, and GIF files are allowed') return res.status(400).json({ status: 400, message: err.message });
  next(err);
};

// Param validation
adminRoutes.param('id', middlewares.checkID);

/**
 * @swagger
 * tags:
 *   - name: Admin Roles
 *     description: Role management for admin users
 *   - name: Admin Users
 *     description: Admin user management
 */

/**
 * @swagger
 * /admin/role:
 *   get:
 *     tags: [Admin Roles]
 *     summary: Get all roles
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of roles
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   role_id:
 *                     type: string
 *                   role_name:
 *                     type: string
 *   post:
 *     tags: [Admin Roles]
 *     summary: Create a new role
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role_name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Role created successfully
 */
adminRoutes.route('/role')
  .post(middlewares.checkBodyNull, verifyToken('admin', ['administrator', 'admin']), createRole)
  .get(verifyToken('admin', ['administrator', 'admin', 'user']), fetchRole);

/**
 * @swagger
 * /admin/role/{id}:
 *   get:
 *     tags: [Admin Roles]
 *     summary: Get role by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Role details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 role_id:
 *                   type: string
 *                 role_name:
 *                   type: string
 *   patch:
 *     tags: [Admin Roles]
 *     summary: Update role by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role_name:
 *                 type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Role updated
 *   delete:
 *     tags: [Admin Roles]
 *     summary: Delete role by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Role deleted
 */
adminRoutes.route('/role/:id')
  .get(verifyToken('admin', ['administrator', 'admin', 'user']), fetchRoleById)
  .patch(middlewares.checkBodyNull, verifyToken('admin', ['administrator', 'admin']), updateRole)
  .delete(verifyToken('admin', ['administrator', 'admin']), deleteRole);

/**
 * @swagger
 * /admin/register:
 *   post:
 *     tags: [Admin Users]
 *     summary: Register new admin
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               role_id:
 *                 type: string
 *               admin_name:
 *                 type: string
 *               admin_email:
 *                 type: string
 *               admin_password:
 *                 type: string
 *               admin_img:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Admin created
 */
adminRoutes.post('/register', upload.single('admin_img'), multerErrorHandler, middlewares.checkBodyNull, createUser);

/**
 * @swagger
 * /admin/sign-in:
 *   post:
 *     tags: [Admin Users]
 *     summary: Admin login
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               admin_email:
 *                 type: string
 *               admin_password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 */
adminRoutes.post('/sign-in', middlewares.checkBodyNull, signIn);

/**
 * @swagger
 * /admin/user:
 *   get:
 *     tags: [Admin Users]
 *     summary: Get all admin users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   admin_id:
 *                     type: string
 *                   admin_name:
 *                     type: string
 *                   admin_email:
 *                     type: string
 */
adminRoutes.route('/user')
  .get(verifyToken('admin', ['administrator', 'admin', 'user']), fetchAllUser);

/**
 * @swagger
 * /admin/user/{id}:
 *   get:
 *     tags: [Admin Users]
 *     summary: Get admin user by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 admin_id:
 *                   type: string
 *                 admin_name:
 *                   type: string
 *                 admin_email:
 *                   type: string
 *   patch:
 *     tags: [Admin Users]
 *     summary: Update admin user by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               role_id:
 *                 type: string
 *               admin_name:
 *                 type: string
 *               admin_status:
 *                 type: string
 *               admin_img:
 *                 type: string
 *                 format: binary
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User updated
 *   delete:
 *     tags: [Admin Users]
 *     summary: Delete admin user by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User deleted
 */
adminRoutes.route('/user/:id')
  .get(verifyToken('admin', ['administrator', 'admin', 'user']), fetchUserById)
  .patch(upload.single('admin_img'), multerErrorHandler, middlewares.checkBodyNull, verifyToken('admin', ['administrator', 'admin']), updateUser)
  .delete(verifyToken('admin', ['administrator', 'admin']), deleteUser);

module.exports = adminRoutes;