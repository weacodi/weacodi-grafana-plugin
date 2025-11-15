import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.API_PORT || '8080', 10),
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  cacheTTL: parseInt(process.env.CACHE_TTL_SECONDS || '3600', 10),
};
