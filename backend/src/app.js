/**
 * Express application factory.
 * Kept separate from server.js so Jest/Supertest can import the app without
 * opening a port (see backend/tests).
 */
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const swaggerUi = require('swagger-ui-express');

const config = require('./config/env');
const routes = require('./routes');
const { spec } = require('./config/swagger');
const { notFoundHandler, errorHandler } = require('./middleware/error');

function createApp() {
  const app = express();

  // Behind nginx / docker we need the real client IP for rate limiting + audit.
  app.set('trust proxy', 1);

  app.use(
    helmet({
      // The API serves JSON and static screenshots; CSP is handled by the
      // frontend hosting layer, so it is disabled here (necessary for Swagger UI).
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.corsOrigins.includes(origin) || config.corsOrigins.includes('*')) {
          return callback(null, true);
        }
        // Unknown origin: respond without CORS headers (the browser blocks the
        // response). Never throw here - that would turn a CORS decision into a 500.
        return callback(null, false);
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (!config.isTest) {
    app.use(morgan(config.isProd ? 'combined' : 'dev'));
  }

  // Screenshots uploaded by testers and by the automation worker
  app.use('/uploads', express.static(path.resolve(config.uploads.dir), { maxAge: '1h' }));

  app.get('/api/health', (req, res) =>
    res.json({ status: 'ok', service: 'backend', env: config.env, time: new Date().toISOString() })
  );

  // Swagger UI  ->  http://localhost:4000/api/docs
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: 'TTA API docs' }));
  app.get('/api/openapi.json', (req, res) => res.json(spec));

  app.use('/api', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
