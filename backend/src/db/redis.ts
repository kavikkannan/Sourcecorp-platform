import { createClient } from 'redis';
import { config } from '../config/env';
import { logger } from '../config/logger';

export const redisClient = createClient({
  socket: {
    host: config.redis.host,
    port: config.redis.port,
  },
});

redisClient.on('error', (err) => {
  logger.error('Redis Client Error', err);
});

redisClient.on('connect', () => {
  logger.info('Redis connected');
});

export const connectRedis = async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    logger.error('Failed to connect to Redis', error);
    throw error;
  }
};

