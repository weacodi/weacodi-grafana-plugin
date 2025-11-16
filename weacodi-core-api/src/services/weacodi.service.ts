import { Redis } from 'ioredis';
import axios from 'axios';
import { config } from '../config';

const HOURS_IN_DAY = 24;
const MAX_CACHE_DAYS = 16;

// Data transfer object aligned with the former Java WeatherResponse
interface OpenMeteoHourly {
  time: string[];
  temperature_2m: number[];
  wind_speed_10m: number[];
  wind_direction_10m: number[];
  relative_humidity_2m: number[];
  cloudcover: number[];
  precipitation: number[];
  rain: number[];
  showers: number[];
  snowfall: number[];
  snow_depth: number[];
  shortwave_radiation: number[];
  uv_index?: number[];
  surface_pressure?: number[];
  precipitation_probability?: number[];
  weather_code?: number[];
  direct_radiation?: number[];
  diffuse_radiation?: number[];
  direct_normal_irradiance?: number[];
  global_tilted_irradiance?: number[];
  terrestrial_radiation?: number[];
}

interface OpenMeteoDaily {
  time: string[];
  sunrise: string[];
  sunset: string[];
}

interface OpenMeteoResponse {
  hourly: OpenMeteoHourly;
  daily: OpenMeteoDaily;
  timezone?: string;
  timezone_abbreviation?: string;
  utc_offset_seconds?: number;
}

// ==========================================================
// Final API response (layers follow the original PlotUtility.java order)
// ==========================================================
interface WeaCoDiResponse {
  time: number[]; // Unix timestamp
  daylight: number[]; // 0 or 100 (day/night mask)
  sun: number[];      // 0-100 (sun intensity adjusted for clouds)
  clouds: number[];   // 0-100 (cloud cover)
  rain: number[];     // precipitation in mm
  snow: number[];     // -1 (none) or >0 (snowfall converted to mm)
  comfort: number[];  // comfort score 10-100
  wind: number[]; // wind speed in km/h (converted downstream if needed)
  temperature: number[]; // ambient temperature in °C
  humidity: number[]; // relative humidity %
  uv: number[]; // UV index
  feelsLike: number[]; // apparent temperature (°C)
  wet: number[]; // 0 dry, 1 wet surface indicator
  ice: number[]; // 0 no icing risk, 1 potential icing (wet + sub-freezing)
  pressure: number[]; // surface pressure in hPa
}
// ==========================================================

// ==========================================================
// Ported calculation helpers
// ==========================================================
export class WeaCoDiService {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  public async getWeatherData(
    lat: number, 
    lon: number, 
    days: number | undefined,
    sensitivity: 'normal' | 'heatSensitive' | 'coldSensitive',
    intensity: 0 | 1 | 2,
    units: 'metric' | 'imperial' | 'nautical'
  ): Promise<any> {
        const normalizedUnits = this.normalizeUnits(units);
        const windowDays = this.normalizeDays(days);
        const cacheKey = this.generateCacheKey(lat, lon, sensitivity, intensity, normalizedUnits, windowDays);
    
    try {
      const cachedData = await this.redis.get(cacheKey);
      if (cachedData) {
        const parsed = JSON.parse(cachedData) as unknown;
        const sanitized = this.sanitizeResponse(parsed);
        if (this.hasLegacyFields(parsed)) {
          try {
            await this.redis.set(cacheKey, JSON.stringify(sanitized), 'EX', config.cacheTTL);
          } catch (rewriteErr) {
            // noop
          }
        }
        return this.applyUnits(sanitized, normalizedUnits);
      }
    } catch (err) {
      // noop
    }

    const openMeteoData = await this.fetchFromOpenMeteo(lat, lon, MAX_CACHE_DAYS);

    if (!openMeteoData) {
      throw new Error('Failed to fetch data from Open-Meteo');
    }

    const fullResult = this.calculateWeaCoDi(openMeteoData, sensitivity, intensity, windowDays);
    const sanitizedResult = this.sanitizeResponse(fullResult);
    const convertedResult = this.applyUnits(sanitizedResult, normalizedUnits);

    try {
      await this.redis.set(cacheKey, JSON.stringify(sanitizedResult), 'EX', config.cacheTTL);
    } catch (err) {
      // noop
    }

    return convertedResult;
  }

  // ==========================================================
  // Ported helper methods from the original Android implementation
  // ==========================================================

  private generateCacheKey(
    lat: number, 
    lon: number, 
    sensitivity: string,
    intensity: number,
    units: 'metric' | 'imperial' | 'nautical',
    windowDays: number
  ): string {
    const roundedLat = lat.toFixed(2);
    const roundedLon = lon.toFixed(2);
    return `weacodi:v9:${roundedLat}:${roundedLon}:${sensitivity}:${intensity}:${units}:${windowDays}`;
  }

  /**
   * Step 1: fetch the upstream forecast (aligned with WeatherRepository.java)
   */
  private async fetchFromOpenMeteo(lat: number, lon: number, days: number): Promise<OpenMeteoResponse | null> {
    
    // Keep parity with the Android app request parameters
    const hourlyParams = [
      "temperature_2m", "wind_speed_10m", "wind_direction_10m", "relative_humidity_2m",
      "cloudcover", "precipitation", "rain", "showers", "snowfall", "snow_depth", "surface_pressure",
      "precipitation_probability", "weather_code", "uv_index",
      "shortwave_radiation", "direct_radiation", "diffuse_radiation",
      "direct_normal_irradiance", "global_tilted_irradiance", "terrestrial_radiation"
    ].join(',');

    const dailyParams = [
      "sunrise", "sunset"
    ].join(',');

    const url = `https://api.open-meteo.com/v1/forecast`;

    try {
      const response = await axios.get<OpenMeteoResponse>(url, {
        params: {
          latitude: lat,
          longitude: lon,
          hourly: hourlyParams,
          daily: dailyParams,
          forecast_days: days, 
          past_days: 1,
          timezone: 'auto'
        }
      });
      
      return response.data;

    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Open-Meteo API Call Failed: ${error.response?.data || error.message}`);
      } else if (error instanceof Error) {
        throw new Error(`Open-Meteo API Call Failed: ${error.message}`);
      } else {
        throw new Error("Open-Meteo API Call Failed with unknown error");
      }
    }
    return null;
  }

  /**
   * Step 2: core transformation (ported from WeatherUtils.java and PlotUtility.java)
   */
  private calculateWeaCoDi(
    openMeteoData: OpenMeteoResponse,
    sensitivity: 'normal' | 'heatSensitive' | 'coldSensitive',
    intensity: 0 | 1 | 2,
    windowDays: number
  ): WeaCoDiResponse {
    const hourly = openMeteoData.hourly;
    const daily = openMeteoData.daily;
    const timezoneOffsetSeconds = openMeteoData.utc_offset_seconds ?? 0;

    const response: WeaCoDiResponse = {
      time: [],
      daylight: [],
      sun: [],
      clouds: [],
      rain: [],
      snow: [],
      comfort: [],
      wind: [],
      temperature: [],
      humidity: [],
      uv: [],
      feelsLike: [],
      wet: [],
      ice: [],
      pressure: [],
    };

    const currentLocalHour = this.getCurrentLocalHourString(timezoneOffsetSeconds);
    const startIndex = this.findStartIndex(hourly.time, currentLocalHour, windowDays);
    const maxPoints = windowDays * HOURS_IN_DAY;
    const endIndex = Math.min(startIndex + maxPoints, hourly.time.length);
    const precipitationSeries = hourly.precipitation || [];
    const rainSeries = hourly.rain;

    for (let i = startIndex; i < endIndex; i++) {
      
      // 1. Time (Unix)
      const timeStr = hourly.time[i];
      response.time.push(this.toUnixTimestamp(timeStr, timezoneOffsetSeconds));

      // 2. Daylight layer
      let isDay = false;
      for (let j = 0; j < daily.sunrise.length; j++) {
        if (timeStr >= daily.sunrise[j] && timeStr <= daily.sunset[j]) {
          isDay = true;
          break;
        }
      }
      const daylightValue = isDay ? 100 : 0;
      response.daylight.push(daylightValue);

      // 3. Sun layer
      const cloudCover = hourly.cloudcover[i] || 0;
      const sunValue =
        daylightValue === 100
          ? this.calculateSunIntensity(timeStr, daily.sunrise, daily.sunset)
          : 0;
      response.sun.push(sunValue);

      // 4. Clouds layer
      response.clouds.push(cloudCover);

      // 5. Rain layer
      const rainValue = hourly.rain[i] || 0;
      response.rain.push(Math.max(rainValue, 0));

      // 6. Snow layer
      const snowValue = hourly.snowfall[i] || 0;
      response.snow.push(snowValue > 0 ? snowValue * 10 : -1);

      // 7. Actual wind speed (km/h)
      const windSpeed = hourly.wind_speed_10m[i] || 0;
      response.wind.push(windSpeed);

      // 8. Comfort layer
      const temperature = hourly.temperature_2m[i];
      const humidity = hourly.relative_humidity_2m[i] ?? 0;
      response.humidity.push(Math.max(0, Math.min(100, humidity ?? 0)));
      const uvIndex = hourly.uv_index?.[i] ?? 0;
      response.uv.push(Math.max(uvIndex, 0));
      const feelsLike = this.calculateApparentTemperature(temperature, humidity, windSpeed);
      response.feelsLike.push(feelsLike);
      const wetFlag = this.calculateWetFlag(i, rainSeries, precipitationSeries);
      response.wet.push(wetFlag);
      const iceFlag = this.calculateIceFlag(wetFlag, temperature);
      response.ice.push(iceFlag);
      const pressure = hourly.surface_pressure?.[i] ?? 0;
      response.pressure.push(Math.max(pressure, 0));
      const precipitation = hourly.precipitation[i];
      const solarRadiation = hourly.shortwave_radiation[i] ?? 0;
      
      // Calculate dew point (ported helper)
      const dewPoint = this.calculateDewPoint(temperature, humidity);

      // Calculate comfort level (ported helper)
      const comfortValue = this.calculateCyclingComfortLevel(
        temperature,
        dewPoint,
        windSpeed,
        precipitation,
        humidity,
        solarRadiation,
        sensitivity,
        intensity
      );
      response.comfort.push(comfortValue);
      response.temperature.push(temperature);
    }
    
    return response;
  }

  private hasLegacyFields(raw: unknown): boolean {
    if (!raw || typeof raw !== 'object') {
      return false;
    }
    const obj = raw as Record<string, unknown>;
    return (
      'temperatureActual' in obj ||
      'temperatureDayMarkers' in obj ||
      'temperatureNightMarkers' in obj ||
      'windActual' in obj
    );
  }

  private sanitizeResponse(raw: unknown): WeaCoDiResponse {
    if (!raw || typeof raw !== 'object') {
      throw new Error('Invalid WeaCoDi payload received from cache');
    }

    const source = raw as Record<string, unknown>;
    const actualTemperature = Array.isArray(source.temperature) ? (source.temperature as number[]) : undefined;
    const legacyTemperature = Array.isArray(source.temperatureActual)
      ? (source.temperatureActual as number[])
      : undefined;
    const actualWind = Array.isArray(source.wind) ? (source.wind as number[]) : undefined;
    const legacyWind = Array.isArray(source.windActual) ? (source.windActual as number[]) : undefined;
    const rawRain = Array.isArray(source.rain) ? (source.rain as number[]) : [];
    const legacyRainDetected = rawRain.some((value) => typeof value === 'number' && value < 0);
    const rain = rawRain.map((value) => {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return 0;
      }
      if (legacyRainDetected) {
        return value <= 0 ? 0 : value / 10;
      }
      return Math.max(value, 0);
    });

    const sanitized: WeaCoDiResponse = {
      time: Array.isArray(source.time) ? (source.time as number[]) : [],
      daylight: Array.isArray(source.daylight) ? (source.daylight as number[]) : [],
      sun: Array.isArray(source.sun) ? (source.sun as number[]) : [],
      clouds: Array.isArray(source.clouds) ? (source.clouds as number[]) : [],
      rain,
      snow: Array.isArray(source.snow) ? (source.snow as number[]) : [],
      comfort: Array.isArray(source.comfort) ? (source.comfort as number[]) : [],
      wind: actualWind ?? legacyWind ?? [],
      temperature: actualTemperature ?? legacyTemperature ?? [],
      humidity: Array.isArray(source.humidity) ? (source.humidity as number[]) : [],
      uv: Array.isArray(source.uv) ? (source.uv as number[]) : [],
      feelsLike: Array.isArray(source.feelsLike) ? (source.feelsLike as number[]) : [],
      wet: Array.isArray(source.wet) ? (source.wet as number[]) : [],
      ice: Array.isArray(source.ice) ? (source.ice as number[]) : [],
      pressure: Array.isArray(source.pressure) ? (source.pressure as number[]) : [],
    };

    // Remove legacy fields if they are still cached
    delete source.temperatureDayMarkers;
    delete source.temperatureNightMarkers;
    delete source.temperatureActual;
    delete source.windActual;

    return sanitized;
  }

  private normalizeUnits(units: string | undefined): 'metric' | 'imperial' | 'nautical' {
    if (units === 'imperial') {
      return 'imperial';
    }
    if (units === 'nautical') {
      return 'nautical';
    }
    return 'metric';
  }

  private normalizeDays(days: number | undefined): number {
    if (!Number.isFinite(days)) {
      return MAX_CACHE_DAYS;
    }
    const value = Math.max(1, Math.floor(days as number));
    return Math.min(MAX_CACHE_DAYS, value);
  }

  private applyUnits(data: WeaCoDiResponse, units: 'metric' | 'imperial' | 'nautical'): WeaCoDiResponse {
    if (units === 'imperial') {
      const toFahrenheit = (value: number) => this.round((value * 9) / 5 + 32, 1);
      const toMilesPerHour = (value: number) => this.round(value * 0.621371, 1);
      const toInches = (value: number) => this.round(value / 25.4, 2);
      const toInchesHg = (value: number) => this.round(value * 0.0295299830714, 2);

      return {
        ...data,
        temperature: data.temperature.map(toFahrenheit),
        feelsLike: data.feelsLike.map(toFahrenheit),
        wind: data.wind.map(toMilesPerHour),
        rain: data.rain.map(toInches),
        pressure: data.pressure.map(toInchesHg),
      };
    }

    if (units === 'nautical') {
      const toKnots = (value: number) => this.round(value * 0.539957, 1);
      return {
        ...data,
        wind: data.wind.map(toKnots),
      };
    }

    return data;
  }

  private getCurrentLocalHourString(offsetSeconds: number): string {
    const now = new Date();
    const localMillis = now.getTime() + offsetSeconds * 1000;
    return this.formatHour(new Date(localMillis));
  }

  private formatHour(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hour = String(date.getUTCHours()).padStart(2, '0');
    return `${year}-${month}-${day}T${hour}`;
  }

  private findStartIndex(times: string[], currentHour: string, windowDays: number): number {
    const idx = times.findIndex((time) => time >= currentHour);
    if (idx !== -1) {
      return idx;
    }
    const fallbackPoints = windowDays * HOURS_IN_DAY;
    return Math.max(times.length - fallbackPoints, 0);
  }

  private toUnixTimestamp(timeStr: string, offsetSeconds: number): number {
    const parsed = new Date(`${timeStr}Z`).getTime();
    if (Number.isNaN(parsed)) {
      return Math.floor(Date.now() / 1000);
    }
    return Math.floor((parsed - offsetSeconds * 1000) / 1000);
  }

  private calculateWetFlag(idx: number, rainSeries: number[], precipitationSeries: number[]): number {
    const safeRain = (value: number | undefined) => Math.max(value ?? 0, 0);
    const currentRain = safeRain(rainSeries[idx]);
    const currentPrecip = Math.max(safeRain(precipitationSeries[idx]), currentRain);

    if (currentRain >= 0.1 || currentPrecip >= 0.1) {
      return 1;
    }

    let sumLast12 = 0;
    for (let offset = 1; offset <= 12; offset++) {
      const j = idx - offset;
      if (j < 0) {
        break;
      }
      const value = Math.max(safeRain(precipitationSeries[j]), safeRain(rainSeries[j]));
      sumLast12 += value;
      if (sumLast12 >= 0.8) {
        return 1;
      }
    }

    let sumLast24 = sumLast12;
    for (let offset = 13; offset <= 24; offset++) {
      const j = idx - offset;
      if (j < 0) {
        break;
      }
      const value = Math.max(safeRain(precipitationSeries[j]), safeRain(rainSeries[j]));
      sumLast24 += value;
      if (sumLast24 >= 2) {
        return 1;
      }
    }

    return 0;
  }

  private calculateIceFlag(wetFlag: number, temperatureCelsius: number | undefined): number {
    if (wetFlag <= 0) {
      return 0;
    }
    if (typeof temperatureCelsius !== 'number' || Number.isNaN(temperatureCelsius)) {
      return 0;
    }
    return temperatureCelsius <= -1 ? 1 : 0;
  }

  private round(value: number, decimals: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  private calculateSunIntensity(timeStr: string, sunrises: string[], sunsets: string[]): number {
    if (!sunrises?.length || !sunsets?.length) {
      return 0;
    }

    for (let idx = 0; idx < sunrises.length; idx++) {
      const sunrise = sunrises[idx];
      const sunset = sunsets[idx];
      if (!sunrise || !sunset) {
        continue;
      }
      if (timeStr >= sunrise && timeStr <= sunset) {
        const sunriseHour = this.parseIsoHour(sunrise);
        const sunsetHour = this.parseIsoHour(sunset);
        const timeHour = this.parseIsoHour(timeStr);
        const noon = sunriseHour + (sunsetHour - sunriseHour) / 2;
        const span = Math.abs(noon - sunriseHour);
        if (span <= 0) {
          return 100;
        }
        const diff = Math.abs(timeHour - noon);
        const intensity = 1 - diff / span;
        return Math.max(0, Math.min(100, Math.round(intensity * 100)));
      }
    }

    return 0;
  }

  private parseIsoHour(timeStr: string): number {
    if (!timeStr || timeStr.length < 16) {
      return 0;
    }
    const hour = Number(timeStr.substring(11, 13)) || 0;
    const minute = Number(timeStr.substring(14, 16)) || 0;
    return hour + minute / 60;
  }

  /**
   * Ported from WeatherUtils.java (calculateDewPoint)
   * @param temperature Celsius
   * @param humidity percent (1-100)
   * @returns Dew point in Celsius
   */
  private calculateDewPoint(temperature: number, humidity: number): number {
    //
    if (humidity < 1 || humidity > 100) {
        humidity = Math.max(1, Math.min(100, humidity));
    }

    // Constants for positive and negative temperature ranges
    const bPositive = 17.368;
    const cPositive = 238.88;
    const bNegative = 17.966;
    const cNegative = 247.15;

    const b = (temperature > 0) ? bPositive : bNegative;
    const c = (temperature > 0) ? cPositive : cNegative;

    const pa = (humidity / 100.0) * Math.exp(b * temperature / (c + temperature));

    return (c * Math.log(pa)) / (b - Math.log(pa));
  }

  /**
   * Ported from WeatherUtils.java (calculateCyclingComfortLevel)
   * @returns Comfort level (10-100)
   */
  private calculateCyclingComfortLevel(
    temperature: number,
    dewPoint: number,
    windSpeed: number,
    precipitation: number,
    humidity: number,
    solarRadiation: number,
    sensitivity: string,
    intensity: number
  ): number {
    //
    let score = 10;
    // const TAG = "ComfortCalc"; // Original Log.d calls replaced with console logs

    // 1. Temperature
    if (temperature < 5 || temperature > 35) {
        score -= 4;
    } else if ((temperature >= 5 && temperature < 15) || (temperature >= 25 && temperature <= 35)) {
        score -= 2;
    }
    if (temperature < -6) {
        score -= 3;
    } else if (temperature < -3) {
        score -= 2;
    } else if (temperature < 0) {
        score -= 1;
    }
    if (temperature > 40) {
        score -= 3;
    }

    // 2. Dew Point
    if (dewPoint <= 10) {
        score += 1;
    } else if (dewPoint <= 16) {
        const penalty = dewPoint <= 13 ? 0 : (dewPoint <= 16 ? -1 : 0);
        if (penalty !== 0) {
            score += penalty;
        }
    } else if (dewPoint <= 19) {
        score -= 2;
    } else if (dewPoint <= 22) {
        score -= 3;
    } else if (dewPoint <= 25) {
        score -= 4;
    } else {
        score -= 5;
    }

    // 3. Wind
    if (windSpeed > 25) {
        score -= 3;
    } else if (windSpeed >= 15) {
        score -= 1;
    } else if (windSpeed >= 5 && temperature > 25 && dewPoint > 16) {
        score += 1;
    }

    // 4. Precipitation
    if (precipitation > 10) {
        score -= 5;
    } else if (precipitation >= 5) {
        score -= 3;
    } else if (precipitation >= 1) {
        score -= 1;
    }

    // 5. Solar Radiation
    if (temperature < 10 && solarRadiation > 300) {
        score += 2;
    } else if (temperature < 20 && solarRadiation > 500) {
        score += 1;
    } else if (temperature > 28 && solarRadiation > 400) {
        score -= 2;
    } else if (temperature > 25 && solarRadiation > 300) {
        score -= 1;
    }

    // Overheat conditions
    if (dewPoint > 18 && solarRadiation > 400 && windSpeed < 10 && temperature > 25) {
        score -= 1;
    }
    if (dewPoint > 21 && solarRadiation > 500 && windSpeed < 5 && temperature > 28) {
        score -= 2;
    }

    // 6. Sensitivity
    if (sensitivity.toLowerCase() === "heatsensitive") {
        if (dewPoint > 16) {
            score -= 1;
        }
        if (temperature > 28) {
            score -= 1;
        }
    } else if (sensitivity.toLowerCase() === "coldsensitive") {
        if (temperature < 10) {
            score -= 1;
        }
        if (windSpeed > 15) {
            score -= 1;
        }
    }

    // 7. Intensity effect
    if (dewPoint > 22 && temperature > 30) {
        const penalty = intensity === 2 ? -4 : (intensity === 1 ? -3 : -2);
        score += penalty;
    } else if (dewPoint > 19 && temperature > 28) {
        const penalty = intensity === 2 ? -3 : (intensity === 1 ? -2 : -1);
        score += penalty;
    }

    // Final clamping
    score = Math.max(1, Math.min(score, 10));
    return score * 10;
  }

  private calculateApparentTemperature(temperature: number, humidity: number, windSpeedKmh: number): number {
    const ta = temperature;
    const rh = Math.max(0, Math.min(100, humidity));
    const windMs = Math.max(0, windSpeedKmh) / 3.6;
    const vaporPressure =
      (rh / 100) *
      6.105 *
      Math.exp((17.27 * ta) / (237.7 + ta));
    const apparent = ta + 0.33 * vaporPressure - 0.7 * windMs - 4.0;
    return Math.round((apparent + Number.EPSILON) * 10) / 10;
  }
}
