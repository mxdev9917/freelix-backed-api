const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const basicAuth = require('express-basic-auth');
require('dotenv').config({ path: path.resolve(__dirname, 'config.env') });

const aiRoutes = require('./routes/aiRoutes');
const adminRoutes = require('./routes/adminRoutes');
const apiRoutes = require('./routes/apiRoutes');
const testRutes=require('./routes/testRouter');
const locationRoutes = require('./routes/locationRoutes');
const { writePool, readPool, testConnections, closePools } = require('./db/connection');
const errors = require('./utils/errors');
const faceController = require('./controllers/aiController/faceController'); // ✅ Import fixed

const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

const app = express();
const port = process.env.PORT || 3000;

// -----------------------------
// Middleware
// -----------------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// -----------------------------
// Routes
// -----------------------------
app.use('/ai', aiRoutes);
app.use('/web', adminRoutes);
app.use('/api', apiRoutes);
app.use('/location', locationRoutes);
app.use('/test',testRutes);

// -----------------------------
// Swagger with Basic Auth
// -----------------------------
app.use(
  '/api-docs',
  basicAuth({
    users: { [process.env.SWAGGER_USER]: process.env.SWAGGER_PASSWORD },
    challenge: true,
  }),
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec)
);

// -----------------------------
// Base route
// -----------------------------
app.get('/', (res) => {
  res.json({ message: 'Welcome to the API', docs: '/api-docs' });
});

// -----------------------------
// Health Check
// -----------------------------
app.get('/health', async (req, res) => {
    try {
        await testConnections();
        res.status(200).json({
            status: 'healthy',
            version,
            uptime: process.uptime(),
            database: { write: 'connected', read: 'connected' },
        });
    } catch (err) {
        res.status(503).json({
            status: 'unhealthy',
            version,
            uptime: process.uptime(),
            database: { write: 'disconnected', read: 'disconnected' },
        });
    }
});

// -----------------------------
// 404 handler
// -----------------------------
app.use((req, res) => {
  res.status(404).json({ status: 404, message: 'Not Found' });
});

app.use(errors.pathError);
app.use(errors.apiError);

// -----------------------------
// Start Server
// -----------------------------
(async () => {
  try {
    console.log('🚀 Starting AI model and database initialization...');
    await Promise.all([
      faceController.loadModels(), // ✅ Now defined
      testConnections(),
    ]);
    console.log('✅ AI models and databases initialized successfully');

    const server = app.listen(port, () => {
      console.log(`🚀 Server running on port ${port} [${process.env.NODE_ENV}]`);
      console.log(`📚 Swagger docs at http://localhost:${port}/api-docs`);
    });

    // -----------------------------
    // Graceful Shutdown
    // -----------------------------
    process.on('SIGTERM', async () => {
      console.log('🛑 SIGTERM received. Performing graceful shutdown...');
      await closePools();
      server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
      });
    });

    process.on('uncaughtException', async (err) => {
      console.error('❌ Uncaught Exception:', err);
      await closePools();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      await closePools();
      process.exit(1);
    });

  } catch (err) {
    console.error('❌ Failed to initialize:', err);
    await closePools();
    process.exit(1);
  }
})();