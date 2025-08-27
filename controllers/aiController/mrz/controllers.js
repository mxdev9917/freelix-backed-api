const axios = require('axios');
const express = require('express');
const { Image } = require('image-js');
const mrz = require('mrz');
const { Agent } = require('https');
const { getMrz } = require('mrz-detection');
const path = require('path');
const fs = require('fs').promises;
const env = require('../../../env');
const { 
  parseMrzDateExpire, 
  parseMrzDateOfBirth, 
  recognizeMrz, 
  saveImageFromBase64 
} = require('./functions');
const dayjs = require('dayjs');
const { v4: uuidv4 } = require('uuid');

// Utility function to sanitize filename
function sanitizeFilename(filename) {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 100);
}

// Generate filename with multiple fallback options
function generatePassportFilename(passportData) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  
  if (passportData.firstName && passportData.lastName && passportData.passportNumber) {
    const name = `${passportData.firstName}_${passportData.lastName}_${passportData.passportNumber}_${timestamp}`;
    return sanitizeFilename(name) + '.jpg';
  } else if (passportData.passportNumber) {
    const name = `passport_${passportData.passportNumber}_${timestamp}`;
    return sanitizeFilename(name) + '.jpg';
  } else {
    return `passport_${timestamp}_${random}.jpg`;
  }
}

// Save image from base64 with custom naming
async function saveImageFromBase64WithCustomName(req, passportData) {
  if (req.body.image && req.body.image.startsWith('data:image')) {
    const base64Data = req.body.image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    const customName = passportData ? 
      generatePassportFilename(passportData) : 
      `passport_${Date.now()}_${Math.random().toString(36).substring(2, 11)}.jpg`;
    
    const uploadsDir = path.join(process.cwd(), 'uploads', 'identity');
    await fs.mkdir(uploadsDir, { recursive: true });
    
    const filePath = path.join(uploadsDir, customName);
    
    try {
      await fs.writeFile(filePath, buffer);
      return { filePath, filename: customName };
    } catch (error) {
      console.error('Error saving image:', error);
      throw error;
    }
  }
  return null;
}

// Rename file after MRZ processing
async function renamePassportImage(originalPath, passportData) {
  try {
    const newFilename = generatePassportFilename(passportData);
    const uploadsDir = path.join(process.cwd(), 'uploads', 'identity');
    const newPath = path.join(uploadsDir, newFilename);
    
    await fs.access(originalPath);
    await fs.rename(originalPath, newPath);
    
    return { 
      success: true, 
      newPath, 
      newFilename,
      originalPath 
    };
  } catch (error) {
    console.error('Error renaming file:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      originalPath 
    };
  }
}

// Save HTTP image with custom naming
async function saveHttpImageWithCustomName(imageUrl, passportData) {
  try {
    const config = {
      responseType: 'arraybuffer',
      httpsAgent: new Agent({
        rejectUnauthorized: false,
      }),
    };
    
    const response = await axios.get(imageUrl, config);
    const buffer = Buffer.from(response.data);
    const customName = passportData ? 
      generatePassportFilename(passportData) : 
      `passport_http_${Date.now()}_${Math.random().toString(36).substring(2, 11)}.jpg`;
    
    const uploadsDir = path.join(process.cwd(), 'uploads', 'identity');
    await fs.mkdir(uploadsDir, { recursive: true });
    
    const filePath = path.join(uploadsDir, customName);
    await fs.writeFile(filePath, buffer);
    
    return { filePath, filename: customName };
  } catch (error) {
    console.error('Error saving HTTP image:', error);
    throw error;
  }
}

// Main controller function
async function readMrzController(req, res) {
  let image = null;
  let originalImagePath = null;
  let tempImageInfo = null;

  // Ensure uploads directory exists
  try {
    await ensureUploadsDirectory();
  } catch (error) {
    console.error('Failed to ensure uploads directory:', error);
    return res.status(500).json({
      status: 'failed',
      message: 'Server configuration error',
      error: 'Could not create uploads directory'
    });
  }

  // Handle base64 images
  if (`${req.body.image}`.startsWith('data:image')) {
    console.log('Loading image base64');
    try {
      const savedPath = await saveImageFromBase64(req);
      image = await Image.load(req.body.image);
      
      const timestamp = Date.now();
      const tempFilename = `temp_${timestamp}_${Math.random().toString(36).substring(2, 11)}.jpg`;
      const tempPath = path.join(process.cwd(), 'uploads', 'identity', tempFilename);
      
      const base64Data = req.body.image.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      await fs.writeFile(tempPath, buffer);
      
      tempImageInfo = { filePath: tempPath, filename: tempFilename };
      originalImagePath = tempPath;
    } catch (e) {
      console.error('Load base64 image error:', e);
      return res.status(400).json({
        status: 'failed',
        message: 'Failed to load base64 image',
        error: e instanceof Error ? e.message : 'Unknown error'
      });
    }
  } 
  // Handle HTTP URLs
  else if (`${req.body.image}`.startsWith('http')) {
    console.log('Loading image from http: ' + req.body.image);
    try {
      const config = {
        responseType: 'arraybuffer',
        httpsAgent: new Agent({
          rejectUnauthorized: false,
        }),
      };
      
      const response = await axios.get(req.body.image, config);
      const buffer = Buffer.from(response.data);
      image = await Image.load(buffer);
      
      const tempFilename = `temp_http_${Date.now()}_${Math.random().toString(36).substring(2, 11)}.jpg`;
      const tempPath = path.join(process.cwd(), 'uploads', 'identity', tempFilename);
      await fs.writeFile(tempPath, buffer);
      
      tempImageInfo = { filePath: tempPath, filename: tempFilename };
      originalImagePath = tempPath;
    } catch (e) {
      console.error('Load HTTP image error:', e);
      return res.status(400).json({
        status: 'failed',
        message: 'Failed to load image from HTTP URL',
        error: e instanceof Error ? e.message : 'Unknown error'
      });
    }
  } 
  // Handle file extensions check
  else if (['png', 'jpg', 'jpeg'].some((ext) => `${req.body.image}`.toLowerCase().endsWith(`.${ext}`))) {
    return res.status(400).json({
      status: 'failed',
      message: 'Invalid image format or path',
    });
  } 
  // Handle uploaded files
  else {
    try {
      console.log('Loading image from file path: ' + req.file?.path);
      if (!req.file?.filename) {
        throw new Error('No file uploaded');
      }
      
      originalImagePath = req.file.path;
      await fs.access(originalImagePath); // Verify file exists
      image = await Image.load(originalImagePath);
      console.log('Image loaded from file');
    } catch (e) {
      console.error('Load binary image error:', e);
      return res.status(400).json({
        status: 'failed',
        message: 'Failed to load uploaded image',
        error: e instanceof Error ? e.message : 'Unknown error'
      });
    }
  }

  if (!image) {
    return res.status(400).json({
      status: 'failed',
      message: 'Unexpected error: Could not load image',
    });
  }

  // Crop MRZ area
  let cropped;
  try {
    cropped = getMrz(image);
    console.log('MRZ area cropped successfully');
  } catch (e) {
    console.error('MRZ cropping error:', e);
    if (tempImageInfo) {
      try {
        await fs.unlink(tempImageInfo.filePath);
      } catch (unlinkError) {
        console.error('Error cleaning up temp file:', unlinkError);
      }
    }
    return res.status(400).json({
      status: 'failed',
      message: 'Cannot crop image for MRZ detection',
      error: e instanceof Error ? e.message : 'Unknown error'
    });
  }

  // Recognize MRZ text
  let mrzData = '';
  try {
    mrzData = await recognizeMrz(req, cropped.toDataURL());
    console.log(`MRZ detected: ${mrzData}`);
  } catch (e) {
    console.error('MRZ recognition error:', e);
    if (tempImageInfo) {
      try {
        await fs.unlink(tempImageInfo.filePath);
      } catch (unlinkError) {
        console.error('Error cleaning up temp file:', unlinkError);
      }
    }
    return res.status(400).json({
      status: 'failed',
      message: 'Cannot read MRZ from image',
      error: e instanceof Error ? e.message : 'Unknown error'
    });
  }

  if (mrzData.length === 0) {
    if (tempImageInfo) {
      try {
        await fs.unlink(tempImageInfo.filePath);
      } catch (unlinkError) {
        console.error('Error cleaning up temp file:', unlinkError);
      }
    }
    return res.status(400).json({
      status: 'failed',
      message: 'No MRZ data found in image',
    });
  }

  // Parse MRZ data
  let format = null;
  let fields = null;
  let valid = false;

  try {
    const parsed = mrz.parse(mrzData.split('\n'));
    format = parsed.format;
    fields = parsed.fields;
    valid = parsed.valid;
    console.log('MRZ parsed successfully:', { format, valid });
  } catch (e) {
    console.error('MRZ parsing error:', e);
    if (tempImageInfo) {
      try {
        await fs.unlink(tempImageInfo.filePath);
      } catch (unlinkError) {
        console.error('Error cleaning up temp file:', unlinkError);
      }
    }
    return res.status(400).json({
      status: 'failed',
      message: 'Cannot parse MRZ data to object',
      error: e instanceof Error ? e.message : 'Unknown error'
    });
  }

  // Build result object
  const result = {
    format: format,
    valid: valid,
    passportNumber: fields?.documentNumber || null,
    firstName: fields?.firstName || null,
    lastName: fields?.lastName || null,
    sex: fields?.sex ? `${fields.sex.charAt(0).toUpperCase()}${fields.sex.substring(1)}` : null,
    countryOfCitizenship: fields?.nationality || null,
    countryOfPassport: fields?.issuingState || null,
    birthDate: fields?.birthDate ? parseMrzDateOfBirth(`${fields.birthDate}`) : null,
    expirationDate: fields?.expirationDate ? parseMrzDateExpire(`${fields.expirationDate}`) : null,
  };

  // PATCH: Rename image file based on extracted passport data
  let finalImageInfo = {};
  
  if (originalImagePath && (result.firstName || result.lastName || result.passportNumber)) {
    try {
      const renameResult = await renamePassportImage(originalImagePath, result);
      if (renameResult.success) {
        console.log(`Image renamed to: ${renameResult.newFilename}`);
        finalImageInfo = {
          originalFilename: tempImageInfo?.filename || req.file?.filename || 'unknown',
          newFilename: renameResult.newFilename,
          imagePath: renameResult.newPath,
          renamed: true
        };
      } else {
        console.error('Failed to rename image:', renameResult.error);
        finalImageInfo = {
          originalFilename: tempImageInfo?.filename || req.file?.filename || 'unknown',
          newFilename: null,
          imagePath: originalImagePath,
          renamed: false,
          renameError: renameResult.error
        };
      }
    } catch (error) {
      console.error('Error during image renaming:', error);
      finalImageInfo = {
        originalFilename: tempImageInfo?.filename || req.file?.filename || 'unknown',
        newFilename: null,
        imagePath: originalImagePath,
        renamed: false,
        renameError: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  } else {
    if (tempImageInfo) {
      try {
        await fs.unlink(tempImageInfo.filePath);
        console.log('Cleaned up temporary file');
      } catch (unlinkError) {
        console.error('Error cleaning up temp file:', unlinkError);
      }
    }
    
    finalImageInfo = {
      originalFilename: req.file?.filename || 'unknown',
      newFilename: null,
      imagePath: originalImagePath,
      renamed: false,
      reason: 'Insufficient data for renaming'
    };
  }

  // Add image info to result
  result.imageInfo = finalImageInfo;

  // Include original fields if requested
  if (env.NODE_ENV !== 'production' || req.body['include-origin'] === 'true') {
    result.origin = fields;
  }

  // Debug logging in development
  if (env.NODE_ENV === 'development') {
    console.log('Final result:', {
      status: 'success',
      data: {
        mrz: mrzData,
        passport: result,
      },
    });
  }

  // Return successful response
  return res.json({
    status: 'success',
    data: {
      mrz: mrzData,
      passport: result,
    },
  });
}

// Utility function to check if uploads directory exists and create it
async function ensureUploadsDirectory() {
  const uploadsDir = path.join(process.cwd(), 'uploads', 'identity');
  try {
    await fs.access(uploadsDir);
  } catch (error) {
    console.log('Creating uploads directory...');
    await fs.mkdir(uploadsDir, { recursive: true });
  }
}

// Initialize uploads directory on module load
ensureUploadsDirectory().catch(console.error);

// Export all functions
module.exports = {
  readMrzController,
  saveImageFromBase64WithCustomName,
  renamePassportImage,
  saveHttpImageWithCustomName,
  ensureUploadsDirectory
};