const multer = require('multer');
const path = require('path');
const fs = require('fs');

const createUpload = (destinationPath, options = {}) => {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(__dirname, '../', destinationPath);
      fs.mkdir(uploadPath, { recursive: true }, (err) => {
        if (err) return cb(err);
        cb(null, uploadPath);
      });
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    },
  });

  return multer({
    storage,
    ...options,
    limits: options.limits || { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  });
};

module.exports = createUpload;