const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const { body, validationResult } = require('express-validator');
const { version } = require('./package.json');

// Controllers and routes
const faceController = require('./controllers/aiController/faceController');
const aiRoutes = require('./routes/aiRoutes');
const adminRoutes = require('./routes/adminRoutes');
const locationRoutes = require('./routes/locationRoutes');
const apiRoutes = require('./routes/apiRoutes');
const { writePool, readPool, testConnections, closePools } = require('./db/connection');
const errors = require('./utils/errors');

// Swagger setup
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');


require('dotenv').config({ path: path.resolve(__dirname, 'config.env') });

const app = express();

// === SECURITY MIDDLEWARE ===
// Disable CSP temporarily or configure carefully to avoid blocking swagger assets
app.use(helmet({
    contentSecurityPolicy: false, // Disable for now to avoid blocking swagger-ui scripts/styles
    crossOriginEmbedderPolicy: false,
}));

// === CORS CONFIGURATION ===
const allowedOrigins = [
    'https://api.freelix.com.la',
    'http://localhost:4000',
    'http://127.0.0.1:3000',
    'http://10.0.2.2:3000',
    'http://localhost:5173',
    'https://freelix.com.la',
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 200,
}));

// === LOGGING & BODY PARSING ===
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === STATIC FILES ===
app.use('/uploads', express.static(path.join(__dirname, 'Uploads')));

// === SWAGGER SETUP ===
const swaggerSpec = swaggerJsdoc(swaggerOptions);
const swaggerUiOptions = {
    explorer: true,
    customCss: `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin: 50px 0; }
    .swagger-ui .scheme-container { display: none; }
  `,
    customSiteTitle: "Freelix API Documentation",
    customfavIcon: "/favicon.ico",
    swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
    }
};
// Place swagger before any other routes to avoid conflicts
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

// === ROUTES ===
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




app.get('/', (req, res) => {
    res.send(`The freelix backend system is working V.${version}`);
});

app.use('/ai', [
    body('*.param').optional().isString().notEmpty(),
    (req, res, next) => {
        const errorsResult = validationResult(req);
        if (!errorsResult.isEmpty()) {
            return res.status(400).json({ errors: errorsResult.array() });
        }
        next();
    }
], aiRoutes);

app.use('/web', adminRoutes);
app.use('/api', apiRoutes);
app.use('/location', locationRoutes);

// === ERROR HANDLING ===
app.use(errors.pathError);
app.use(errors.apiError);

// === SERVER INITIALIZATION ===
async function initialize() {
    try {
        console.log('Starting AI model and database initialization...');
        await Promise.all([
            faceController.loadModels(),
            testConnections(),
        ]);
        console.log('✅ AI models and databases initialized successfully');

        const PORT = process.env.PORT || 3000;
        const server = app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV}]`);
            console.log(`📚 Swagger docs at http://localhost:${PORT}/api-docs`);
        });

        // Graceful shutdown handlers
        process.on('SIGTERM', async () => {
            console.log('🛑 SIGTERM received. Performing graceful shutdown...');
            await closePools();
            server.close(() => {
                console.log('✅ Server closed');
                process.exit(0);
            });
        });

        process.on('uncaughtException', async (err) => {
            console.error('Uncaught Exception:', err);
            await closePools();
            process.exit(1);
        });

        process.on('unhandledRejection', async (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
            await closePools();
            process.exit(1);
        });

    } catch (err) {
        console.error('❌ Failed to initialize:', err);
        await closePools();
        process.exit(1);
    }
}

initialize();

module.exports = app;
