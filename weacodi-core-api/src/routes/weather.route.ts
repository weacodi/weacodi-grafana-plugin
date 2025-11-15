import { FastifyInstance } from 'fastify';
import { WeaCoDiService } from '../services/weacodi.service';

// Fastify validation schema
const querystringSchema = {
  type: 'object',
  required: ['lat', 'lon'],
  properties: {
    lat: { type: 'number', minimum: -90, maximum: 90 },
    lon: { type: 'number', minimum: -180, maximum: 180 },
    days: { type: 'integer', minimum: 1, maximum: 16 },
    // Additional parameters exposed from `calculateCyclingComfortLevel`
    sensitivity: { type: 'string', enum: ['normal', 'heatSensitive', 'coldSensitive'], default: 'normal' },
    intensity: { type: 'integer', enum: [0, 1, 2], default: 0 }, // 0=rec, 1=commute, 2=active
    units: { type: 'string', enum: ['metric', 'imperial', 'nautical'], default: 'metric' },
  },
};

interface WeatherQuery {
  lat: number;
  lon: number;
  days?: number;
  sensitivity: 'normal' | 'heatSensitive' | 'coldSensitive';
  intensity: 0 | 1 | 2;
  units: 'metric' | 'imperial' | 'nautical';
}

export async function weatherRoutes(app: FastifyInstance) {
  
  app.get<{ Querystring: WeatherQuery }>('/weather', { schema: { querystring: querystringSchema } }, async (request, reply) => {
    
    // app.redis is provided by the Redis plugin
    const weacodiService = new WeaCoDiService(app.redis); 
    
    const { lat, lon, days, sensitivity, intensity, units } = request.query;

    try {
      // Delegate to the service layer that mirrors the Android logic
      const weatherData = await weacodiService.getWeatherData(
        lat, 
        lon, 
        days, 
        sensitivity, 
        intensity,
        units
      );
      return weatherData;
    } catch (error) {
      app.log.error(error);
      reply.status(500).send({ error: 'Failed to fetch weather data' });
    }
  });
}
