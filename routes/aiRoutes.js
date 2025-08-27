const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const faceController = require('../controllers/aiController/faceController');
const mrzControllers = require('../controllers/aiController/mrz/controllers');

const aiRoutes = express.Router();

// ---------------- Multer Configuration ----------------
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../../Uploads/identity');
    fs.mkdir(uploadPath, { recursive: true }, (err) => cb(err, uploadPath));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const allowedMimes = [
  'image/jpeg', 'image/jpg', 'image/png', 
  'image/gif', 'image/bmp', 'image/webp'
];

const fileFilter = (req, file, cb) => {
  if (file.originalname.endsWith('.pt') || allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and .pt files allowed.'));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter
});

// ---------------- Upload Error Handler ----------------
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, error: 'File too large', message: 'File size must be less than 5MB' });
  } else if (error) {
    return res.status(400).json({ success: false, error: 'File validation error', message: error.message });
  }
  next();
};

// ---------------- Swagger Documentation ----------------
/**
 * @swagger
 * tags:
 *   name: AI
 *   description: Face comparison and MRZ recognition endpoints
 */

/**
 * @swagger
 * /ai/compare-faces:
 *   post:
 *     summary: Compare a personal photo with a passport photo
 *     tags: [AI]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               personalPhoto:
 *                 type: string
 *                 format: binary
 *               passportPhotoPath:
 *                 type: string
 *                 description: Server path to passport photo
 *     responses:
 *       200:
 *         description: Comparison result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 similarity: { type: string }
 *                 distance: { type: string }
 *                 isMatch: { type: boolean }
 *                 matchLevel: { type: string }
 */

/**
 * @swagger
 * /ai/mrz:
 *   post:
 *     summary: Extract MRZ information from a passport image
 *     tags: [AI]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: MRZ recognition result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     mrz: { type: string }
 *                     passport:
 *                       type: object
 *                       properties:
 *                         passportNumber: { type: string }
 *                         firstName: { type: string }
 *                         lastName: { type: string }
 *                         birthDate: { type: string }
 *                         expirationDate: { type: string }
 *                         sex: { type: string }
 *                         countryOfPassport: { type: string }
 *                         countryOfCitizenship: { type: string }
 *                         imageInfo:
 *                           type: object
 *                           properties:
 *                             originalFilename: { type: string }
 *                             newFilename: { type: string }
 *                             imagePath: { type: string }
 *                             renamed: { type: boolean }
 */

// ---------------- Routes ----------------
aiRoutes.post(
  '/compare-faces', 
  upload.single('personalPhoto'), 
  handleUploadError, 
  faceController.compareFaces
);

aiRoutes.post(
  '/mrz', 
  upload.single('image'), 
  handleUploadError, 
  mrzControllers.readMrzController
);



module.exports = aiRoutes;