// Complete multer setup with debugging
const multer = require('multer');
const path = require('path');

// Debug middleware to log all request details
const debugMiddleware = (req, res, next) => {
  console.log('=== REQUEST DEBUG INFO ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', {
    'content-type': req.headers['content-type'],
    'content-length': req.headers['content-length'],
  });
  console.log('Body keys:', Object.keys(req.body || {}));
  console.log('Body:', req.body);
  console.log('Files:', req.files);
  console.log('File:', req.file);
  next();
};

// Multer configuration with detailed logging
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  console.log('=== FILE FILTER DEBUG ===');
  console.log('File info:', {
    fieldname: file.fieldname,
    originalname: file.originalname,
    encoding: file.encoding,
    mimetype: file.mimetype
  });
  
  // Accept only images
  if (file.mimetype.startsWith('image/')) {
    console.log('File accepted');
    cb(null, true);
  } else {
    console.log('File rejected - not an image');
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1
  }
});

// Enhanced updateUserImg with comprehensive debugging
const updateUserImg = async (req, res) => {
  console.log('=== UPDATE USER IMAGE FUNCTION START ===');
  
  try {
    // Log everything about the request
    console.log('Request headers:', req.headers);
    console.log('Request body:', req.body);
    console.log('Request file exists:', !!req.file);
    
    if (req.file) {
      console.log('File details:', {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        encoding: req.file.encoding,
        mimetype: req.file.mimetype,
        size: req.file.size,
        bufferExists: !!req.file.buffer,
        bufferLength: req.file.buffer ? req.file.buffer.length : 0,
        bufferType: typeof req.file.buffer
      });
    } else {
      console.log('No file in request');
    }

    // Check if multer processed the file
    if (req.multerError) {
      console.log('Multer error:', req.multerError);
      return res.status(400).json({
        success: false,
        message: `File upload error: ${req.multerError.message}`
      });
    }

    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: "User ID is required" 
      });
    }

    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: "No file uploaded. Make sure to include a file with field name 'image'" 
      });
    }

    if (!req.file.buffer) {
      console.error('Buffer is missing from file object');
      return res.status(400).json({ 
        success: false, 
        message: "File buffer is missing - multer memory storage not working properly" 
      });
    }

    if (req.file.buffer.length === 0) {
      console.error('Buffer is empty');
      return res.status(400).json({ 
        success: false, 
        message: "File buffer is empty" 
      });
    }

    console.log('✅ File validation passed');

    // Find user
    const [users] = await readPool.query(
      "SELECT user_id, user_img FROM Users WHERE user_id = ?",
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    const user = users[0];
    let fileName;

    // Process the image
    if (user.user_img && user.user_img !== DEFAULT_AVATAR) {
      const fileExistsInMinIO = await fileExists("users", user.user_img);
      
      if (fileExistsInMinIO) {
        console.log('Replacing existing image');
        const result = await replaceImage(
          "users", 
          user.user_img, 
          req.file.buffer, 
          req.file.mimetype
        );
        
        if (!result.success) {
          return res.status(500).json({ 
            success: false, 
            message: result.message 
          });
        }
        fileName = user.user_img;
      } else {
        console.log('Uploading new file (existing not found)');
        fileName = await uploadFile(req.file, "users");
      }
    } else {
      console.log('Uploading new file (no existing image)');
      fileName = await uploadFile(req.file, "users");
    }

    // Update database
    await updateUserFieldDB("Users", "user_id", user.user_id, "user_img", fileName, false);

    return res.status(200).json({
      success: true,
      message: "User image updated successfully",
      filename: fileName,
      userId: user.user_id,
    });
    
  } catch (err) {
    console.error("ERROR in updateUserImg:", err);
    
    if (err instanceof multer.MulterError) {
      console.log('Multer error type:', err.code);
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      message: `Internal server error: ${err.message}` 
    });
  }
};

// Test endpoint to verify multer is working
const testUpload = (req, res) => {
  console.log('=== TEST UPLOAD ENDPOINT ===');
  console.log('Body:', req.body);
  console.log('File:', req.file);
  
  if (!req.file) {
    return res.json({
      success: false,
      message: 'No file received',
      body: req.body,
      headers: req.headers
    });
  }
  
  return res.json({
    success: true,
    message: 'File received successfully',
    file: {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      bufferLength: req.file.buffer.length
    },
    body: req.body
  });
};

// Route setup examples (add these to your routes file):
/*
// Test route to verify multer is working
router.post('/test-upload', debugMiddleware, upload.single('image'), testUpload);

// Actual image update route
router.patch('/user/image', debugMiddleware, upload.single('image'), updateUserImg);
*/

module.exports = {
  updateUserImg,
  testUpload,
  upload,
  debugMiddleware
};