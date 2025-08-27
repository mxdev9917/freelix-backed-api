const fs = require('fs');
const stream = require('stream'); // ADD THIS LINE - Import stream module
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
async function uploadFile(bucketName, file) {
  try {
    if (!file) throw new Error("No file provided");
    if (!bucketName) throw new Error("Bucket name is required");

    const isConnected = await verifyMinioConnection();
    if (!isConnected) {
      throw new Error('Storage service unavailable: Cannot connect to MinIO server');
    }

    await ensureBucket(bucketName);

    const objectName = `${Date.now()}-${file.originalname.replace(/[^\w.-]/g, '_')}`;
    
    const metaData = {
      'Content-Type': file.mimetype,
      'Original-Filename': file.originalname,
      'Upload-Date': new Date().toISOString()
    };

    let fileData;
    if (file.buffer) fileData = file.buffer;
    else if (file.path) fileData = fs.readFileSync(file.path);
    else throw new Error('File data not available');

    await minioClient.putObject(bucketName, objectName, fileData, metaData);

    if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);

    // Return full URL
    const MINIO_URL = process.env.MINIO_URL || 'http://localhost:9000';
    const fileUrl = `${objectName}`;
    return fileUrl;

  } catch (err) {
    console.error('Upload function error:', err);
    throw err;
  }
}


/**
 * Get file from MinIO by filename
 * Returns file buffer and metadata
 */
async function getFileByName(bucketName, fileName) {
  try {
    if (!bucketName) throw new Error("Bucket name is required");
    if (!fileName) throw new Error("File name is required");

    // Verify MinIO connection
    const isConnected = await verifyMinioConnection();
    if (!isConnected) {
      throw new Error('Storage service unavailable: Cannot connect to MinIO server');
    }

    // Check if bucket exists
    const bucketExists = await minioClient.bucketExists(bucketName);
    if (!bucketExists) {
      throw new Error(`Bucket "${bucketName}" does not exist`);
    }

    // Get file stream
    const stream = await minioClient.getObject(bucketName, fileName);
    
    // Convert stream to buffer
    const chunks = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);
          
          // Get file metadata
          const stat = await minioClient.statObject(bucketName, fileName);
          
          resolve({
            buffer,
            metadata: stat.metaData,
            size: stat.size,
            lastModified: stat.lastModified,
            etag: stat.etag
          });
        } catch (err) {
          reject(err);
        }
      });
      stream.on('error', reject);
    });

  } catch (err) {
    console.error('Get file error:', err);
    throw err;
  }
}

/**
 * Get file URL by filename
 */
async function getFileUrl(bucketName, fileName) {
  try {
    if (!bucketName) throw new Error("Bucket name is required");
    if (!fileName) throw new Error("File name is required");

    const endpoint = process.env.MINIO_ENDPOINT.replace(/^(https?:\/\/)?/, '');
    const useSSL = process.env.MINIO_USE_SSL === 'true';
    const port = process.env.MINIO_PORT;
    
    return `${useSSL ? 'https' : 'http'}://${endpoint}:${port}/${bucketName}/${fileName}`;
    
  } catch (err) {
    console.error('Get file URL error:', err);
    throw err;
  }
}

/**
 * Check if file exists in MinIO
 */
async function fileExists(bucketName, fileName) {
  try {
    if (!bucketName) throw new Error("Bucket name is required");
    if (!fileName) throw new Error("File name is required");

    // Verify MinIO connection
    const isConnected = await verifyMinioConnection();
    if (!isConnected) {
      throw new Error('Storage service unavailable: Cannot connect to MinIO server');
    }

    // Check if bucket exists
    const bucketExists = await minioClient.bucketExists(bucketName);
    if (!bucketExists) {
      return false;
    }

    // Try to get file stats - if it doesn't exist, it will throw an error
    await minioClient.statObject(bucketName, fileName);
    return true;
    
  } catch (err) {
    if (err.code === 'NotFound') {
      return false;
    }
    console.error('File exists check error:', err);
    throw err;
  }
}

/**
 * Delete file from MinIO by filename
 */
async function deleteFileByName(bucketName, fileName) {
  try {
    if (!bucketName) throw new Error("Bucket name is required");
    if (!fileName) throw new Error("File name is required");

    // Verify MinIO connection
    const isConnected = await verifyMinioConnection();
    if (!isConnected) {
      throw new Error('Storage service unavailable: Cannot connect to MinIO server');
    }

    // Check if bucket exists
    const bucketExists = await minioClient.bucketExists(bucketName);
    if (!bucketExists) {
      throw new Error(`Bucket "${bucketName}" does not exist`);
    }

    // Check if file exists
    const exists = await fileExists(bucketName, fileName);
    if (!exists) {
      throw new Error(`File "${fileName}" does not exist in bucket "${bucketName}"`);
    }

    // Delete the file
    await minioClient.removeObject(bucketName, fileName);
    console.log(`✅ File "${fileName}" deleted from bucket "${bucketName}"`);
    
    return true;
    
  } catch (err) {
    console.error('Delete file error:', err);
    throw err;
  }
}

/**
 * List all files in a bucket with optional prefix filter
 */
async function listFiles(bucketName, prefix = '') {
  try {
    if (!bucketName) throw new Error("Bucket name is required");

    // Verify MinIO connection
    const isConnected = await verifyMinioConnection();
    if (!isConnected) {
      throw new Error('Storage service unavailable: Cannot connect to MinIO server');
    }

    // Check if bucket exists
    const bucketExists = await minioClient.bucketExists(bucketName);
    if (!bucketExists) {
      throw new Error(`Bucket "${bucketName}" does not exist`);
    }

    const files = [];
    const stream = minioClient.listObjects(bucketName, prefix, true);
    
    return new Promise((resolve, reject) => {
      stream.on('data', (obj) => {
        files.push({
          name: obj.name,
          size: obj.size,
          lastModified: obj.lastModified,
          etag: obj.etag
        });
      });
      stream.on('end', () => resolve(files));
      stream.on('error', reject);
    });

  } catch (err) {
    console.error('List files error:', err);
    throw err;
  }
}

/**
 * Search files by filename pattern
 */
async function searchFiles(bucketName, searchPattern) {
  try {
    if (!bucketName) throw new Error("Bucket name is required");
    if (!searchPattern) throw new Error("Search pattern is required");

    const allFiles = await listFiles(bucketName);
    
    // Filter files that match the search pattern (case insensitive)
    const filteredFiles = allFiles.filter(file => 
      file.name.toLowerCase().includes(searchPattern.toLowerCase())
    );
    
    return filteredFiles;
    
  } catch (err) {
    console.error('Search files error:', err);
    throw err;
  }
}

/**
 * Get files by date range
 */
async function getFilesByDateRange(bucketName, startDate, endDate) {
  try {
    if (!bucketName) throw new Error("Bucket name is required");
    if (!startDate || !endDate) throw new Error("Start and end dates are required");

    const allFiles = await listFiles(bucketName);
    
    // Convert dates to Date objects
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Filter files within date range
    const filteredFiles = allFiles.filter(file => {
      const fileDate = new Date(file.lastModified);
      return fileDate >= start && fileDate <= end;
    });
    
    return filteredFiles;
    
  } catch (err) {
    console.error('Get files by date range error:', err);
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

/**
 * Replace (overwrite) an image in MinIO using stream
 */
async function replaceImage(bucketName, filename, fileBuffer, mimeType) {
  try {
    const exists = await minioClient.bucketExists(bucketName);
    if (!exists) {
      throw new Error(`Bucket "${bucketName}" does not exist`);
    }

    const bufferStream = new stream.PassThrough();
    bufferStream.end(fileBuffer);

    await minioClient.putObject(bucketName, filename, bufferStream, {
      "Content-Type": mimeType,
      "Content-Length": fileBuffer.length
    });

    return { success: true, message: "Image replaced successfully", filename };
  } catch (err) {
    console.error("MinIO replace error:", err);
    return { success: false, message: err.message };
  }
}


module.exports = { 
  uploadFile, 
  getFileByName,
  getFileUrl,
  fileExists,
  deleteFileByName,
  listFiles,
  searchFiles,
  getFilesByDateRange,
  ensureBucket, 
  verifyMinioConnection, 
  handleUploadError,
  replaceImage
};