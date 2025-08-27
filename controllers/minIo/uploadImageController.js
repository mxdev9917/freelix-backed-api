const fs = require('fs');
const minioClient = require("./minioClient");

/**
 * Ensure MinIO bucket exists (creates if not)
 */
async function ensureBucket(bucketName) {
  try {
    const exists = await minioClient.bucketExists(bucketName);
    if (!exists) {
      await minioClient.makeBucket(bucketName, "us-east-1");
      console.log(`✅ Bucket "${bucketName}" created.`);
    }
    return true;
  } catch (err) {
    console.error(`❌ Bucket check error for "${bucketName}":`, err);
    throw new Error(`Bucket operation failed: ${err.message}`);
  }
}

/**
 * Verify MinIO connection
 */
async function verifyMinioConnection() {
  try {
    await minioClient.listBuckets();
    return true;
  } catch (err) {
    console.error('MinIO connection error:', err.message);
    return false;
  }
}

/**
 * Upload file to MinIO - handles both memory and disk storage
 * Returns only the filename
 */
async function uploadFile(file, bucketName) {
  try {
    if (!file) throw new Error("No file provided");
    if (!bucketName) throw new Error("Bucket name is required");

    // Verify MinIO connection
    const isConnected = await verifyMinioConnection();
    if (!isConnected) {
      throw new Error('Storage service unavailable: Cannot connect to MinIO server');
    }

    // Ensure bucket exists
    await ensureBucket(bucketName);

    // Sanitize filename
    const objectName = `${Date.now()}-${file.originalname.replace(/[^\w.-]/g, '_')}`;
    
    // Set metadata
    const metaData = {
      'Content-Type': file.mimetype,
      'Original-Filename': file.originalname,
      'Upload-Date': new Date().toISOString()
    };

    let fileData;
    
    // Handle memory storage (file.buffer exists)
    if (file.buffer) {
      fileData = file.buffer;
    } 
    // Handle disk storage (file.path exists)
    else if (file.path) {
      fileData = fs.readFileSync(file.path);
    } 
    // Neither buffer nor path available
    else {
      throw new Error('File data not available. File must have either buffer (memory storage) or path (disk storage)');
    }

    // Upload file
    await minioClient.putObject(bucketName, objectName, fileData, metaData);

    // Clean up disk file if it exists
    if (file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    // Return only the filename
    return objectName;

  } catch (err) {
    console.error('Upload function error:', err);
    throw err;
  }
}

/**
 * Handle upload errors and return appropriate error object
 */
function handleUploadError(err) {
  console.error('Upload Error:', err.message);

  if (err.message.includes('Boundary not found')) {
    return {
      status: 400,
      error: {
        error: 'Invalid request format',
        message: 'Multipart request must include proper boundary',
        solution: 'Ensure Content-Type header is "multipart/form-data" with boundary parameter'
      }
    };
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return {
      status: 413,
      error: {
        error: 'File too large',
        message: 'Maximum file size is 3000MB'
      }
    };
  }

  if (err.message.includes('Invalid file type')) {
    return {
      status: 415,
      error: {
        error: 'Unsupported file type',
        message: err.message
      }
    };
  }

  if (err.message.includes('Storage service unavailable') || err.message.includes('Bucket operation failed')) {
    return {
      status: 503,
      error: {
        error: 'Storage service unavailable',
        message: 'Cannot connect to storage server'
      }
    };
  }

  if (err.message.includes('No file provided') || err.message.includes('File buffer is missing')) {
    return {
      status: 400,
      error: {
        error: 'No file uploaded',
        message: 'Please include a valid file upload'
      }
    };
  }

  return {
    status: 500,
    error: {
      error: 'Upload Failed',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    }
  };
}

module.exports = { 
  uploadFile, 
  ensureBucket, 
  verifyMinioConnection, 
  handleUploadError 
};