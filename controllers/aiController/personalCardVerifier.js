const ort = require('onnxruntime-node');
const path = require('path');

const MODEL_PATH = path.resolve(__dirname, 'personalCaed.onnx');

let session = null;

async function initModel() {
  if (!session) {
    session = await ort.InferenceSession.create(MODEL_PATH);
    console.log('ONNX model loaded');
  }
  return session;
}

/**
 * Dummy preprocess function - you MUST replace with real image preprocessing,
 * resize, normalize, convert to tensor.
 * 
 * @param {Buffer} imageBuffer
 * @returns {ort.Tensor}
 */
async function preprocess(imageBuffer) {
  // Replace with your actual preprocessing logic
  // Example: resize to 224x224 RGB, normalize, convert to Float32Array

  const dummyData = new Float32Array(1 * 3 * 224 * 224).fill(0);
  return new ort.Tensor('float32', dummyData, [1, 3, 224, 224]);
}

/**
 * Run ONNX model and parse outputs
 * @param {Buffer} imageBuffer 
 * @returns {Object} parsed model outputs
 */
async function runModel(imageBuffer) {
  await initModel();

  const inputTensor = await preprocess(imageBuffer);

  const feeds = {};
  feeds[session.inputNames[0]] = inputTensor;

  const results = await session.run(feeds);

  // Parse outputs
  const output = {};

  if (results.photo) {
    output.photo_confidence = results.photo.data[0]; // example: first float number
  }

  if (results.pid) {
    output.pid = Array.from(results.pid.data); // convert tensor data to array
  }

  if (results.presenal) {
    output.presenal = Array.from(results.presenal.data);
  }

  return output;
}

module.exports = {
  runModel,
};
