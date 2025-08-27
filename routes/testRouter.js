const express = require('express');
const testRoutes = express.Router();
const multer = require('multer');

// Multer setup - Use memory storage (no local file saving)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 3000 * 1024 * 1024, // 3000MB limit
  }
});

// Import the upload functions
const {
  uploadFile,
  getFileByName,
  getFileUrl,
  fileExists,
  deleteFileByName,
  listFiles,
  searchFiles,
  getFilesByDateRange,
  handleUploadError,
  replaceImage
} = require('../controllers/minIo/storageMinIoController');

// Upload test with dynamic bucket
testRoutes.post('/upload', upload.single('file'), async (req, res) => {
  try {
    console.log('Upload request received', {
      file: req.file ? {
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        hasBuffer: !!req.file.buffer
      } : 'No file',
      body: req.body
    });

    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please include a file with the "file" field name'
      });
    }

    const bucketName = "portfolio";

    // ✅ Correct order
    const fileName = await uploadFile(bucketName, req.file);

    res.status(201).json({
      success: true,
      filename: fileName,
      message: 'File uploaded successfully'
    });

  } catch (err) {
    console.error('Upload route error:', err);
    const errorResponse = handleUploadError(err);
    res.status(errorResponse.status).json(errorResponse.error);
  }
});


// Get file by filename
testRoutes.get('/file/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const bucketName = "users";

    const fileData = await getFileByName(bucketName, filename);

    // Set appropriate headers
    res.setHeader('Content-Type', fileData.metadata['content-type'] || 'application/octet-stream');
    res.setHeader('Content-Length', fileData.size);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    // Send the file buffer
    res.send(fileData.buffer);

  } catch (err) {
    console.error('Get file error:', err);
    if (err.code === 'NotFound') {
      return res.status(404).json({ error: 'File not found' });
    }
    res.status(500).json({ error: 'Failed to retrieve file' });
  }
});

// Get file URL
testRoutes.get('/file/:filename/url', async (req, res) => {
  try {
    const { filename } = req.params;
    const bucketName = "users";

    const fileUrl = await getFileUrl(bucketName, filename);
    res.json({ url: fileUrl });

  } catch (err) {
    console.error('Get file URL error:', err);
    res.status(500).json({ error: 'Failed to get file URL' });
  }
});

// Check if file exists
testRoutes.get('/file/:filename/exists', async (req, res) => {
  try {
    const { filename } = req.params;
    const bucketName = "users";

    const exists = await fileExists(bucketName, filename);
    res.json({ exists });

  } catch (err) {
    console.error('File exists check error:', err);
    res.status(500).json({ error: 'Failed to check file existence' });
  }
});

// Delete file by filename
testRoutes.delete('/file/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const bucketName = "users";

    await deleteFileByName(bucketName, filename);
    res.json({ success: true, message: 'File deleted successfully' });

  } catch (err) {
    console.error('Delete file error:', err);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// List all files in bucket
testRoutes.get('/files', async (req, res) => {
  try {
    const bucketName = "users";
    const files = await listFiles(bucketName);
    res.json({ files });

  } catch (err) {
    console.error('List files error:', err);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// Search files by pattern
testRoutes.get('/files/search', async (req, res) => {
  try {
    const { pattern } = req.query;
    const bucketName = "users";

    if (!pattern) {
      return res.status(400).json({ error: 'Search pattern is required' });
    }

    const files = await searchFiles(bucketName, pattern);
    res.json({ files });

  } catch (err) {
    console.error('Search files error:', err);
    res.status(500).json({ error: 'Failed to search files' });
  }
});

// Get files by date range
testRoutes.get('/files/date-range', async (req, res) => {
  try {
    const { start, end } = req.query;
    const bucketName = "users";

    if (!start || !end) {
      return res.status(400).json({ error: 'Start and end dates are required' });
    }

    const files = await getFilesByDateRange(bucketName, start, end);
    res.json({ files });

  } catch (err) {
    console.error('Get files by date range error:', err);
    res.status(500).json({ error: 'Failed to get files by date range' });
  }
});

testRoutes.post("/replace-image", upload.single("image"), async (req, res) => {
  try {
    const bucketName = "users"; // change to your bucket
    const filename = req.body.filename;

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const result = await replaceImage(
      bucketName,
      filename,
      req.file.buffer,
      req.file.mimetype
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


module.exports = testRoutes;