const dayjs = require('dayjs');
const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { createWorker } = require('tesseract.js');
const { v4: uuidv4 } = require('uuid');
const env = require('../../../env');

// MRZ Processing Functions

/**
 * Recognize MRZ text from an image using Tesseract.js
 * @param {object} req - Express request object
 * @param {string|Buffer} image - Image to process
 * @returns {Promise<string>} Recognized MRZ text
 */
async function recognizeMrz(req, image) {
  console.log('Origin:', req.headers.origin);
  console.log('Header host:', req.headers.host);
  console.log('OriginURL:', req.originalUrl);

  const worker = await createWorker({
    langPath: path.join(process.cwd(), 'ocr-lang'), // Local path to language data
    cachePath: path.join(process.cwd(), 'dist'),    // Cache directory
  });

  try {
    await worker.loadLanguage('mrz');
    await worker.initialize('mrz');
    await worker.setParameters({
      tessedit_char_whitelist: '<0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    });

    const { data: { text } } = await worker.recognize(image);
    return text.trim();
  } finally {
    await worker.terminate();
  }
}

/**
 * Parse MRZ date of birth (YYMMDD) to formatted date (YYYY-MM-DD)
 * @param {string} date - MRZ date string (YYMMDD)
 * @returns {string} Formatted date (YYYY-MM-DD)
 */
function parseMrzDateOfBirth(date) {
  try {
    const currentYearShort = dayjs().format('YY');
    const year = parseInt(date.substring(0, 2)) > parseInt(currentYearShort) 
      ? `19${date.substring(0, 2)}` 
      : `20${date.substring(0, 2)}`;
    
    const formattedDate = dayjs(`${year}-${date.substring(2, 4)}-${date.substring(4, 6)}`, 'YYYY-MM-DD');
    
    if (formattedDate.isValid()) {
      return formattedDate.format('YYYY-MM-DD');
    }
  } catch (e) {
    console.error('Date parsing error:', e);
  }
  return date; // Return original if parsing fails
}

/**
 * Parse MRZ expiration date (YYMMDD) to formatted date (YYYY-MM-DD)
 * @param {string} date - MRZ date string (YYMMDD)
 * @returns {string} Formatted date (YYYY-MM-DD)
 */
function parseMrzDateExpire(date) {
  try {
    const formattedDate = dayjs(`20${date.substring(0, 2)}-${date.substring(2, 4)}-${date.substring(4, 6)}`, 'YYYY-MM-DD');
    return formattedDate.isValid() ? formattedDate.format('YYYY-MM-DD') : date;
  } catch (e) {
    console.error('Date parsing error:', e);
    return date;
  }
}

/**
 * Save base64 image to file system
 * @param {object} req - Express request object
 * @returns {Promise<string>} Path to saved image
 */
async function saveImageFromBase64(req) {
  const base64Data = req.body.image.replace(/^data:image\/(png|jpg|jpeg);base64,/, '');
  const filename = `${dayjs().format('YYYYMMDD')}-${uuidv4()}.png`;
  const filepath = path.join(process.cwd(), 'uploads', 'identity', filename);
  
  await fs.mkdirp(path.dirname(filepath));
  await fs.writeFile(filepath, base64Data, 'base64');
  
  return filepath;
}

// Initialize required directories on startup
async function initializeDirectories() {
  const directories = [
    path.join(process.cwd(), 'ocr-lang'),   // For Tesseract language data
    path.join(process.cwd(), 'dist'),       // For Tesseract cache
    path.join(process.cwd(), 'uploads', 'identity') // For uploaded images
  ];

  try {
    await Promise.all(directories.map(dir => fs.mkdirp(dir)));
    console.log('Directories initialized successfully');
  } catch (error) {
    console.error('Failed to initialize directories:', error);
    throw error;
  }
}

// Initialize directories when module loads
initializeDirectories().catch(err => {
  console.error('Initialization error:', err);
});

module.exports = {
  recognizeMrz,
  parseMrzDateOfBirth,
  parseMrzDateExpire,
  saveImageFromBase64
};