require('dotenv').config();
const Minio = require('minio');
const https = require('https'); // ✅ Fix

// Debug: Verify environment variables
console.log('Environment Variables:', {
  MINIO_ENDPOINT: process.env.MINIO_ENDPOINT,
  MINIO_PORT: process.env.MINIO_PORT,
  MINIO_USE_SSL: process.env.MINIO_USE_SSL,
  SERVER_PORT: process.env.SERVER_PORT,
  NODE_ENV: process.env.NODE_ENV
});

// MinIO client configuration
const minioConfig = {
  endPoint: process.env.MINIO_ENDPOINT.replace(/^https?:\/\//, ''),
  port: parseInt(process.env.MINIO_PORT, 10),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
  region: 'us-east-1'
};

// Only add transportOptions if using SSL
if (minioConfig.useSSL) {
  minioConfig.transportOptions = {
    agent: new https.Agent({
      rejectUnauthorized: process.env.NODE_ENV === 'production',
      minVersion: 'TLSv1.2',
      maxVersion: 'TLSv1.3',
      ciphers: [
        'TLS_AES_256_GCM_SHA384',
        'TLS_CHACHA20_POLY1305_SHA256',
        'TLS_AES_128_GCM_SHA256'
      ].join(':'),
      honorCipherOrder: true
    })
  };
}

console.log('MinIO Configuration:', minioConfig);

// Initialize MinIO client
const minioClient = new Minio.Client(minioConfig);

module.exports = minioClient;
