const express = require('express');
const apiRoutes = express.Router();
const multer = require('multer');
const userController = require('../controllers/apiController/userService');
const { createProfile } = require('../controllers/apiController/profiles/controller');
const userControllerV2 = require('../controllers/apiController/users/controller');

// Multer setup
const storage = multer.memoryStorage(); // keeps file in RAM as buffer
const upload = multer({ storage });

/**
 * @swagger
 * tags:
 *   - name: Application User
 *     description: User management API
 *   - name: Profiles
 *     description: User profile & KYC
 *
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     AuthResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: integer
 *           example: 200
 *         message:
 *           type: string
 *           example: Successfully signed in
 *         token:
 *           type: string
 *           description: JWT authentication token
 *           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *         data:
 *           type: string
 *           description: Encrypted user data
 *           example: "U2FsdGVkX19X123..."
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: integer
 *           example: 400
 *         message:
 *           type: string
 *           example: Missing required field: phone
 *     DeleteUserResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         affectedRows:
 *           type: integer
 *           example: 1
 *         userId:
 *           type: string
 *           example: 8b4a0e08-2b7c-4bbf-ae5a-d2f4f6f6a2a1
 *         imageDeleted:
 *           type: boolean
 *           example: true
 *     UpdateUserQueryParams:
 *       type: object
 *       properties:
 *         data_type:
 *           type: string
 *           description: Field to update (phone, user_first, user_last, etc.)
 *         user_id:
 *           type: string
 *           description: User ID
 *         phone:
 *           type: string
 *           description: New phone (if updating phone)
 *         val:
 *           type: string
 *           description: New value for the field
 *     UpdateUserBody:
 *       type: object
 *       properties:
 *         data_type:
 *           type: string
 *           description: Field to update
 *           example: user_first
 *         id_value:
 *           type: string
 *           description: User ID
 *           example: 8b4a0e08-2b7c-4bbf-ae5a-d2f4f6f6a2a1
 *         value:
 *           type: string
 *           description: New value
 *           example: John
 *     UpdateNameRequest:
 *       type: object
 *       required: [user_first, user_last, user_id]
 *       properties:
 *         user_first:
 *           type: string
 *           example: John
 *         user_last:
 *           type: string
 *           example: Doe
 *         user_id:
 *           type: string
 *           example: 8b4a0e08-2b7c-4bbf-ae5a-d2f4f6f6a2a1
 *     RegisterUserRequest:
 *       type: object
 *       required: [phone, user_password]
 *       properties:
 *         phone:
 *           type: string
 *           description: User's phone number
 *           example: "+1234567890"
 *         user_password:
 *           type: string
 *           description: User's password
 *           example: "password123"
 *         user_first:
 *           type: string
 *           example: John
 *         user_last:
 *           type: string
 *           example: Doe
 *         user_birth_date:
 *           type: string
 *           format: date
 *           example: "1990-01-01"
 *         user_gender:
 *           type: string
 *           example: male
 *         user_country:
 *           type: string
 *           example: USA
 *         user_img:
 *           type: string
 *           format: binary
 *           description: User profile image
 *     SignInRequest:
 *       type: object
 *       required: [phone, password]
 *       properties:
 *         phone:
 *           type: string
 *           example: "+1234567890"
 *         password:
 *           type: string
 *           example: "password123"
 *     UpdateImageRequest:
 *       type: object
 *       required: [file, user_id]
 *       properties:
 *         file:
 *           type: string
 *           format: binary
 *           description: New profile image
 *         user_id:
 *           type: string
 *           description: User ID
 *           example: 8b4a0e08-2b7c-4bbf-ae5a-d2f4f6f6a2a1
 *     ProfileCreateRequest:
 *       type: object
 *       properties:
 *         portfolio_path:
 *           type: string
 *           format: binary
 *           description: Portfolio PDF/ZIP
 *         bank_img:
 *           type: string
 *           format: binary
 *           description: Bank book / statement image
 *         card_front_img:
 *           type: string
 *           format: binary
 *           description: National ID front image
 *         passport_img:
 *           type: string
 *           format: binary
 *           description: Passport image
 *       additionalProperties: true
 *       description: >
 *         Multipart form. Besides the files above, additional text fields may be included (e.g., bio, address).
 */

/**
 * @swagger
 * /api/user:
 *   post:
 *     tags: [Application User]
 *     summary: Register new user
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/RegisterUserRequest'
 *     responses:
 *       200:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Missing fields or invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Phone number already registered
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 */
apiRoutes.post('/user', upload.single('user_img'), userController.registerUser);

/**
 * @swagger
 * /api/user/{id}:
 *   delete:
 *     tags: [Application User]
 *     summary: Delete user by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeleteUserResponse'
 *       400:
 *         description: Invalid user ID format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 */
apiRoutes.delete('/user/:id', userController.deleteUser);

/**
 * @swagger
 * /api/user:
 *   patch:
 *     tags: [Application User]
 *     summary: Update user information
 *     description: You may pass parameters either via **query string** or **JSON body**.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: data_type
 *         schema:
 *           type: string
 *         description: Field to update (phone, user_first, user_last, etc.)
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: string
 *         description: User ID
 *       - in: query
 *         name: phone
 *         schema:
 *           type: string
 *         description: New phone value (if updating phone)
 *       - in: query
 *         name: val
 *         schema:
 *           type: string
 *         description: New value for the field
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUserBody'
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         description: Missing fields or invalid field name
 *       404:
 *         description: User not found
 *       409:
 *         description: Phone number already exists
 *       500:
 *         description: Internal server error
 */
apiRoutes.patch('/user', userController.updateUser);

/**
 * @swagger
 * /api/user/sign-in:
 *   post:
 *     tags: [Application User]
 *     summary: Sign in user with phone and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SignInRequest'
 *     responses:
 *       200:
 *         description: User signed in successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Missing fields or bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Account pending or blocked
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
apiRoutes.post('/user/sign-in', userControllerV2.signInUser);

/**
 * @swagger
 * /api/user/name:
 *   patch:
 *     tags: [Application User]
 *     summary: Update user's first and last name
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateNameRequest'
 *     responses:
 *       200:
 *         description: User name updated successfully
 *       400:
 *         description: Missing required fields
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
apiRoutes.patch('/user/name', userController.updateUserName);

/**
 * @swagger
 * /api/user/img:
 *   patch:
 *     tags: [Application User]
 *     summary: Update user profile image
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/UpdateImageRequest'
 *     responses:
 *       200:
 *         description: User image updated successfully
 *       400:
 *         description: No file uploaded or missing user ID
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
apiRoutes.patch('/user/img', upload.single('file'), userController.updateUserImage);

/**
 * @swagger
 * /api/profile:
 *   post:
 *     tags: [Profiles]
 *     summary: Create or update a user profile (with KYC files)
 *     description: >
 *       Upload one or more KYC-related files. Additional text fields are allowed (e.g., bio, address).
 *       Authentication required.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/ProfileCreateRequest'
 *     responses:
 *       201:
 *         description: Profile created/updated successfully
 *       400:
 *         description: Invalid payload
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
apiRoutes.post(
  '/profile',
  upload.fields([
    { name: 'portfolio_path', maxCount: 1 },
    { name: 'bank_img', maxCount: 1 },
    { name: 'card_front_img', maxCount: 1 },
    { name: 'passport_img', maxCount: 1 },
  ]),
  createProfile
);

module.exports = apiRoutes;
