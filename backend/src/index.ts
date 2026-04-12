import app from './app';
import { config } from './config/env';
import { logger } from './config/logger';
import { pool } from './db/pool';
import { connectRedis, redisClient } from './db/redis';

import './workers/export.worker';

const startServer = async () => {
  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    logger.info('Database connected');

    // Connect to Redis
    await connectRedis();

    // Start server
    app.listen(config.port, () => {
      logger.info(`Server started on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down gracefully...');

  try {
    await pool.end();
    await redisClient.quit();
    logger.info('Connections closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error);
    process.exit(1);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

startServer();

