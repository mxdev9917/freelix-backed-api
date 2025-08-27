const ort = require('onnxruntime-node');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

// Change to your actual ONNX model path (rename file if needed)
const MODEL_PATH = path.resolve(__dirname, '../../models/personalCard.onnx');
const INPUT_SIZE = 224;

let session = null;

const initializeModel = async () => {
  try {
    console.log('Loading ONNX model...');
    await fs.access(MODEL_PATH);
    session = await ort.InferenceSession.create(MODEL_PATH, { executionProviders: ['cpu'] });
    console.log('✅ Model loaded successfully');
  } catch (error) {
    console.error('❌ Failed to load model:', error);
    session = null;
    throw error;
  }
};

const processImage = async (imagePath) => {
  try {
    const { data } = await sharp(imagePath)
      .resize(INPUT_SIZE, INPUT_SIZE)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const tensorData = new Float32Array(INPUT_SIZE * INPUT_SIZE * 3);
    for (let i = 0; i < INPUT_SIZE * INPUT_SIZE; i++) {
      tensorData[i] = data[3 * i] / 255.0; // R
      tensorData[i + INPUT_SIZE * INPUT_SIZE] = data[3 * i + 1] / 255.0; // G
      tensorData[i + 2 * INPUT_SIZE * INPUT_SIZE] = data[3 * i + 2] / 255.0; // B
    }

    return new ort.Tensor('float32', tensorData, [1, 3, INPUT_SIZE, INPUT_SIZE]);
  } catch (error) {
    console.error('Image processing failed:', error);
    throw error;
  }
};

const verifyCard = async (req, res) => {
  if (!session) {
    try {
      await initializeModel();
    } catch (error) {
      return res.status(503).json({ success: false, error: 'Model not available', details: error.message });
    }
  }

  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No image file provided' });
  }

  try {
    const inputTensor = await processImage(req.file.path);
    const results = await session.run({ input: inputTensor });
    const confidence = results.output.data[0];
    const isValid = confidence > 0.5;

    await fs.unlink(req.file.path); // Clean up uploaded file

    return res.json({
      success: true,
      isValid,
      confidence: parseFloat(confidence.toFixed(4)),
      message: isValid ? 'Verification successful' : 'Verification failed',
    });
  } catch (error) {
    console.error('Verification error:', error);
    if (req.file) await fs.unlink(req.file.path).catch(() => {});
    return res.status(500).json({ success: false, error: 'Verification failed', details: error.message });
  }
};

module.exports = {
  initializeModel,
  verifyCard,
};
