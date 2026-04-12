import Redis from 'ioredis';
import { config } from '../config/env';
import { logger } from '../config/logger';

export const redisClient = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redisClient.on('error', (err) => {
  logger.error('Redis Client Error', err);
});

redisClient.on('connect', () => {
  logger.info('Redis connected');
});

export const connectRedis = async () => {
  // ioredis connects automatically, but we can verify connection
  try {
    await redisClient.ping();
    logger.info('Redis connection verified');
  } catch (error) {
    logger.error('Failed to connect to Redis', error);
    throw error;
  }
};
