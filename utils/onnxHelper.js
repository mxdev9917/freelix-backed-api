// controllers/idCardController.js
const tf = require('@tensorflow/tfjs-node');
const sharp = require('sharp');
const Tesseract = require('tesseract.js');

class IdCardController {
  constructor() {
    this.model = null;
    this.loadModel();
  }

  // Load your PyTorch model (converted to TensorFlow.js format)
  async loadModel() {
    try {
      // Replace with your actual model path
      // You'll need to convert your personalCaed.pt to TensorFlow.js format
      // this.model = await tf.loadLayersModel('file://./models/personalCard/model.json');
      console.log('Model loading placeholder - convert your .pt file to TensorFlow.js format');
    } catch (error) {
      console.error('Error loading model:', error);
    }
  }

  // Health check endpoint
  healthCheck = async (req, res) => {
    try {
      res.status(200).json({
        success: true,
        message: 'ID Card verification service is running',
        modelLoaded: this.model !== null,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Service health check failed',
        error: error.message
      });
    }
  }

  // Main ID card verification endpoint
  verifyIdCard = async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No ID card image provided'
        });
      }

      const imageBuffer = req.file.buffer;
      
      // Process the image
      const processedImage = await this.preprocessImage(imageBuffer);
      
      // Extract information using OCR and/or ML model
      const extractedInfo = await this.extractCardInfo(processedImage);
      
      // Verify the extracted information
      const verificationResult = await this.validateIdCard(extractedInfo);

      res.status(200).json({
        success: true,
        message: 'ID card processed successfully',
        data: {
          extracted: extractedInfo,
          verification: verificationResult,
          confidence: verificationResult.confidence || 0
        }
      });

    } catch (error) {
      console.error('Error verifying ID card:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to verify ID card',
        error: error.message
      });
    }
  }

  // Extract information from ID card
  extractIdInfo = async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No ID card image provided'
        });
      }

      const imageBuffer = req.file.buffer;
      const processedImage = await this.preprocessImage(imageBuffer);
      const extractedInfo = await this.extractCardInfo(processedImage);

      res.status(200).json({
        success: true,
        message: 'Information extracted successfully',
        data: extractedInfo
      });

    } catch (error) {
      console.error('Error extracting ID info:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to extract ID information',
        error: error.message
      });
    }
  }

  // Preprocess image for better OCR results
  async preprocessImage(imageBuffer) {
    try {
      const processedBuffer = await sharp(imageBuffer)
        .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
        .grayscale()
        .normalize()
        .sharpen()
        .toBuffer();

      return processedBuffer;
    } catch (error) {
      throw new Error(`Image preprocessing failed: ${error.message}`);
    }
  }

  // Extract card information using OCR and ML model
  async extractCardInfo(imageBuffer) {
    try {
      const extractedData = {
        photo: null,
        pid: null,
        personal: {}
      };

      // OCR extraction
      const ocrResult = await Tesseract.recognize(imageBuffer, 'eng', {
        logger: m => console.log(m)
      });

      const text = ocrResult.data.text;
      
      // Extract PID (assuming it's a numeric ID)
      const pidMatch = text.match(/\b\d{8,15}\b/);
      if (pidMatch) {
        extractedData.pid = pidMatch[0];
      }

      // Extract personal information using regex patterns
      extractedData.personal = this.extractPersonalInfo(text);

      // If you have a trained model, use it here
      if (this.model) {
        // Convert image to tensor and predict
        const tensor = await this.imageToTensor(imageBuffer);
        const prediction = this.model.predict(tensor);
        // Process prediction results
        // extractedData.mlPrediction = await this.processPrediction(prediction);
      }

      return extractedData;

    } catch (error) {
      throw new Error(`Information extraction failed: ${error.message}`);
    }
  }

  // Extract personal information from OCR text
  extractPersonalInfo(text) {
    const personal = {};
    
    // Name extraction (customize based on your ID format)
    const namePattern = /Name[:\s]+([A-Za-z\s]+)/i;
    const nameMatch = text.match(namePattern);
    if (nameMatch) {
      personal.name = nameMatch[1].trim();
    }

    // Date of birth extraction
    const dobPattern = /DOB[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i;
    const dobMatch = text.match(dobPattern);
    if (dobMatch) {
      personal.dateOfBirth = dobMatch[1];
    }

    // Address extraction
    const addressPattern = /Address[:\s]+([A-Za-z0-9\s,.-]+)/i;
    const addressMatch = text.match(addressPattern);
    if (addressMatch) {
      personal.address = addressMatch[1].trim();
    }

    return personal;
  }

  // Convert image to tensor for ML model
  async imageToTensor(imageBuffer) {
    try {
      // Resize image to model input size
      const resizedBuffer = await sharp(imageBuffer)
        .resize(224, 224) // Adjust based on your model input size
        .raw()
        .toBuffer();

      // Convert to tensor
      const tensor = tf.tensor3d(new Uint8Array(resizedBuffer), [224, 224, 3])
        .div(255.0) // Normalize to [0,1]
        .expandDims(0); // Add batch dimension

      return tensor;
    } catch (error) {
      throw new Error(`Tensor conversion failed: ${error.message}`);
    }
  }

  // Validate extracted ID card information
  async validateIdCard(extractedInfo) {
    try {
      const validation = {
        isValid: true,
        errors: [],
        confidence: 1.0
      };

      // Validate PID
      if (!extractedInfo.pid || extractedInfo.pid.length < 8) {
        validation.isValid = false;
        validation.errors.push('Invalid or missing PID');
        validation.confidence -= 0.3;
      }

      // Validate personal information
      if (!extractedInfo.personal.name) {
        validation.isValid = false;
        validation.errors.push('Name not found');
        validation.confidence -= 0.2;
      }

      // Add more validation rules as needed
      validation.confidence = Math.max(0, validation.confidence);

      return validation;
    } catch (error) {
      throw new Error(`Validation failed: ${error.message}`);
    }
  }
}

module.exports = new IdCardController();