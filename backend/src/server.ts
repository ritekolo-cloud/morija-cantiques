import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';

import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { logger } from './utils/logger';
import { errorHandler, notFound } from './middleware/error.middleware';
import { generalLimiter } from './middleware/rateLimit.middleware';
import { swaggerSpec } from './config/swagger';
import apiRoutes from './routes';

const app = express();

// Trust the first proxy (required for Render, Heroku, etc. reverse proxies)
// This fixes express-rate-limit's X-Forwarded-For validation error
app.set('trust proxy', 1);
const httpServer = createServer(app);
const corsOrigin = env.corsOrigins.includes('*') ? true : env.corsOrigins;

// Socket.io for real-time notifications (optional)
export const io = new Server(httpServer, {
  cors: { origin: corsOrigin, credentials: true },
});

io.on('connection', (socket) => {
  logger.info(`Client connected via websocket: ${socket.id}`);
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(compression());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.isDev ? 'dev' : 'combined'));

// Rate limiting globally
app.use('/api', generalLimiter);

// Swagger Documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use('/api', apiRoutes);

if (env.isProd) {
  // Try multiple possible paths for the frontend dist folder.
  // On Render: /opt/render/project/src/frontend/dist
  // Locally:   <repo-root>/frontend/dist
  const candidatePaths = [
    path.resolve(__dirname, '../../frontend/dist'),   // backend/dist -> frontend/dist
    path.resolve(__dirname, '../../../frontend/dist'), // extra nesting
    path.resolve(process.cwd(), 'frontend/dist'),      // from cwd
    path.resolve(process.cwd(), '../frontend/dist'),   // one up from cwd
  ];

  const frontendDist = candidatePaths.find(p => fs.existsSync(p));

  if (frontendDist) {
    logger.info(`✅ Serving frontend from: ${frontendDist}`);
    app.use(express.static(frontendDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  } else {
    logger.error(`❌ Could not find frontend/dist. Tried: ${candidatePaths.join(', ')}`);
    // Fallback: respond with helpful error instead of 500
    app.get('*', (_req, res) => {
      res.status(503).json({
        success: false,
        message: 'Frontend build not found. Please ensure frontend is built during deployment.',
      });
    });
  }
}

// 404 & Global Error Handling
app.use(notFound);
app.use(errorHandler);

// Start server
async function startServer() {
  await connectDatabase();
  logger.info(`📁 __dirname: ${__dirname}`);
  logger.info(`📁 process.cwd(): ${process.cwd()}`);
  
  httpServer.listen(env.port, () => {
    logger.info(`🚀 Server running in ${env.nodeEnv} mode on port ${env.port}`);
    logger.info(`📚 Swagger docs available at http://localhost:${env.port}/api/docs`);
  });
}

// Graceful shutdown
function gracefulShutdown() {
  logger.info('Shutting down server...');
  httpServer.close(async () => {
    await disconnectDatabase();
    logger.info('Server safely shut down');
    process.exit(0);
  });
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

startServer();
