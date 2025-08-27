const tf = require('@tensorflow/tfjs');
const faceapi = require('face-api.js');
const { createCanvas, loadImage, Image, ImageData } = require('canvas');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

// Initialize canvas environment
const canvas = createCanvas(1, 1);
const canvasConstructor = canvas.constructor;

// Critical environment patching
faceapi.env.monkeyPatch({
  Canvas: canvasConstructor,
  Image: Image,
  ImageData: ImageData,
  createCanvasElement: () => createCanvas(),
  createImageElement: () => new Image(),
  createImageData: (arr, width, height) => new ImageData(arr, width, height),
  fetch: fetch
});

let modelsLoaded = false;

async function loadModels() {
  if (!modelsLoaded) {
    try {
      // Set TensorFlow backend to CPU
      await tf.setBackend('cpu');
      await tf.ready();
      console.log(`TensorFlow backend initialized: ${tf.getBackend()}`);
      
      // Load face detection models
      console.log('Loading face detection models...');
      await faceapi.nets.ssdMobilenetv1.loadFromDisk('Model');
      await faceapi.nets.faceLandmark68Net.loadFromDisk('Model');
      await faceapi.nets.faceRecognitionNet.loadFromDisk('Model');
      
      modelsLoaded = true;
      console.log('All models loaded successfully');
    } catch (err) {
      console.error('Model loading failed:', err);
      throw err;
    }
  }
}

async function compareFaces(req, res) {
  try {
    await loadModels();

    if (!req.file || !req.body.passportPhotoPath) {
      return res.status(400).json({ 
        error: 'Personal photo file and passport photo path are required',
        details: {
          personalPhoto: req.file ? 'Uploaded' : 'Missing',
          passportPhotoPath: req.body.passportPhotoPath ? 'Provided' : 'Missing'
        }
      });
    }

    // Construct full path to passport photo with security validation
    const passportPhotoPath = path.join(
      __dirname, 
      '../../uploads/identity', 
      path.basename(req.body.passportPhotoPath) // Prevent directory traversal
    );

    // Check if passport photo exists
    if (!fs.existsSync(passportPhotoPath)) {
      return res.status(400).json({ 
        error: 'Passport photo not found at the specified path',
        path: req.body.passportPhotoPath,
        resolvedPath: passportPhotoPath
      });
    }

    // Load images
    const [img1, img2] = await Promise.all([
      loadImage(req.file.path), // Personal photo from upload
      loadImage(passportPhotoPath) // Passport photo from path
    ]);

    // Detect faces
    const [detections1, detections2] = await Promise.all([
      faceapi.detectAllFaces(img1)
        .withFaceLandmarks()
        .withFaceDescriptors(),
      faceapi.detectAllFaces(img2)
        .withFaceLandmarks()
        .withFaceDescriptors()
    ]);

    if (detections1.length === 0 || detections2.length === 0) {
      return res.json({ 
        success: false,
        message: detections1.length === 0 ? 'No face in personal photo' : 'No face in passport photo'
      });
    }

    // Calculate similarity
    const distance = faceapi.euclideanDistance(
      detections1[0].descriptor,
      detections2[0].descriptor
    );

    // Cleanup: delete the uploaded personal photo after processing
    fs.unlink(req.file.path, (err) => {
      if (err) console.error('Error deleting temporary file:', err);
    });

    res.json({
      success: true,
      similarity: (1 - distance).toFixed(4),
      distance: distance.toFixed(4),
      isMatch: distance < 0.6,
      matchLevel: getMatchLevel(distance),
      tensorflowBackend: tf.getBackend()
    });

  } catch (error) {
    console.error('Comparison error:', error);
    
    // Cleanup in case of error
    if (req.file?.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting temporary file:', err);
      });
    }

    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
}

function getMatchLevel(distance) {
  if (distance < 0.4) return 'Excellent Match';
  if (distance < 0.5) return 'Good Match';
  if (distance < 0.6) return 'Moderate Match';
  return 'Poor Match';
}

module.exports = {
  compareFaces,
  loadModels
};