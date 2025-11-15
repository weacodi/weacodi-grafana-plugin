import Fastify from 'fastify';
import fastifyRedis from '@fastify/redis';
import Redis from 'ioredis';
import { config } from './config';
import { weatherRoutes } from './routes/weather.route';

export async function buildApp() {
  const app = Fastify({ logger: true });

  const redisClient = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    lazyConnect: true,
  });

  await redisClient.connect();

  await app.register(fastifyRedis, {
    client: redisClient,
    closeClient: true,
  });

  await app.register(weatherRoutes, { prefix: '/api/v1' });

  return app;
}
