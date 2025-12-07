const HOURS_IN_DAY = 24;
const MAX_FORECAST_DAYS = 16;

export const OPEN_METEO_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
export const OPEN_METEO_HOURLY_FIELDS = [
  'temperature_2m',
  'wind_speed_10m',
  'wind_direction_10m',
  'relative_humidity_2m',
  'cloudcover',
  'precipitation',
  'rain',
  'showers',
  'snowfall',
  'snow_depth',
  'surface_pressure',
  'precipitation_probability',
  'weather_code',
  'uv_index',
  'shortwave_radiation',
  'direct_radiation',
  'diffuse_radiation',
  'direct_normal_irradiance',
  'global_tilted_irradiance',
  'terrestrial_radiation',
].join(',');

export const OPEN_METEO_DAILY_FIELDS = ['sunrise', 'sunset'].join(',');

export type Sensitivity = 'normal' | 'heatSensitive' | 'coldSensitive';
export type ComfortIntensity = 0 | 1 | 2;
export type Units = 'metric' | 'imperial' | 'nautical';

export interface OpenMeteoHourly {
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
  shortwave_radiation?: number[];
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

export interface OpenMeteoDaily {
  time: string[];
  sunrise: string[];
  sunset: string[];
}

export interface OpenMeteoResponse {
  hourly: OpenMeteoHourly;
  daily: OpenMeteoDaily;
  timezone?: string;
  timezone_abbreviation?: string;
  utc_offset_seconds?: number;
}

export interface WeaCoDiResponse {
  time: number[];
  daylight: number[];
  sun: number[];
  clouds: number[];
  rain: number[];
  snow: number[];
  comfort: number[];
  wind: number[];
  temperature: number[];
  humidity: number[];
  uv: number[];
  feelsLike: number[];
  wet: number[];
  ice: number[];
  pressure: number[];
}

export interface BuildWeacodiOptions {
  windowDays: number;
  sensitivity: Sensitivity;
  intensity: ComfortIntensity;
  units: Units;
}

export function buildWeacodiResponse(openMeteoData: OpenMeteoResponse, options: BuildWeacodiOptions): WeaCoDiResponse {
  if (!openMeteoData?.hourly || !openMeteoData?.daily) {
    throw new Error('Open-Meteo payload is missing required fields');
  }

  const { windowDays, sensitivity, intensity, units } = options;
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

  const precipitationSeries = hourly.precipitation ?? [];
  const rainSeries = hourly.rain ?? [];
  const windSeries = hourly.wind_speed_10m ?? [];
  const humiditySeries = hourly.relative_humidity_2m ?? [];
  const temperatures = hourly.temperature_2m ?? [];
  const uvSeries = hourly.uv_index ?? [];
  const pressureSeries = hourly.surface_pressure ?? [];
  const snowSeries = hourly.snowfall ?? [];
  const cloudSeries = hourly.cloudcover ?? [];
  const solarRadiationSeries = hourly.shortwave_radiation ?? [];

  const currentLocalHour = getCurrentLocalHourString(timezoneOffsetSeconds);
  const startIndex = findStartIndex(hourly.time, currentLocalHour, windowDays);
  const maxPoints = windowDays * HOURS_IN_DAY;
  const endIndex = Math.min(startIndex + maxPoints, hourly.time.length);

  for (let i = startIndex; i < endIndex; i++) {
    const timeStr = hourly.time[i];
    response.time.push(toUnixTimestamp(timeStr, timezoneOffsetSeconds));

    const daylightValue = isDaylight(timeStr, daily.sunrise, daily.sunset) ? 100 : 0;
    response.daylight.push(daylightValue);

    const sunValue =
      daylightValue === 100 ? calculateSunIntensity(timeStr, daily.sunrise, daily.sunset) : 0;
    response.sun.push(sunValue);

    response.clouds.push(cloudSeries[i] ?? 0);

    const rainValue = rainSeries[i] ?? 0;
    response.rain.push(Math.max(rainValue, 0));

    const snowValue = snowSeries[i] ?? 0;
    response.snow.push(snowValue > 0 ? snowValue * 10 : -1);

    const windSpeed = windSeries[i] ?? 0;
    response.wind.push(windSpeed);

    const temperature = temperatures[i] ?? 0;
    response.temperature.push(temperature);

    const humidity = clampPercentage(humiditySeries[i] ?? 0);
    response.humidity.push(humidity);

    const uvIndex = Math.max(uvSeries[i] ?? 0, 0);
    response.uv.push(uvIndex);

    const feelsLike = calculateApparentTemperature(temperature, humidity, windSpeed);
    response.feelsLike.push(feelsLike);

    const wetFlag = calculateWetFlag(i, rainSeries, precipitationSeries);
    response.wet.push(wetFlag);
    const iceFlag = calculateIceFlag(wetFlag, temperature);
    response.ice.push(iceFlag);

    const pressure = pressureSeries[i] ?? 0;
    response.pressure.push(Math.max(pressure, 0));

    const precipitation = precipitationSeries[i] ?? 0;
    const solarRadiation = solarRadiationSeries[i] ?? 0;
    const dewPoint = calculateDewPoint(temperature, humidity);
    const comfort = calculateCyclingComfortLevel(
      temperature,
      dewPoint,
      windSpeed,
      precipitation,
      humidity,
      solarRadiation,
      sensitivity,
      intensity
    );
    response.comfort.push(comfort);
  }

  return applyUnits(response, units);
}

export function normalizeUnits(units: string | undefined): Units {
  if (units === 'imperial') {
    return 'imperial';
  }
  if (units === 'nautical') {
    return 'nautical';
  }
  return 'metric';
}

export function normalizeDays(days: number | undefined): number {
  if (!Number.isFinite(days)) {
    return MAX_FORECAST_DAYS;
  }
  const value = Math.max(1, Math.floor(days as number));
  return Math.min(MAX_FORECAST_DAYS, value);
}

function applyUnits(data: WeaCoDiResponse, units: Units): WeaCoDiResponse {
  if (units === 'imperial') {
    const toFahrenheit = (value: number) => round((value * 9) / 5 + 32, 1);
    const toMilesPerHour = (value: number) => round(value * 0.621371, 1);
    const toInches = (value: number) => round(value / 25.4, 2);
    const toInchesHg = (value: number) => round(value * 0.0295299830714, 2);

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
    const toKnots = (value: number) => round(value * 0.539957, 1);
    return {
      ...data,
      wind: data.wind.map(toKnots),
    };
  }

  return data;
}

function isDaylight(timeStr: string, sunrises: string[], sunsets: string[]): boolean {
  for (let idx = 0; idx < sunrises.length; idx++) {
    const sunrise = sunrises[idx];
    const sunset = sunsets[idx];
    if (timeStr >= sunrise && timeStr <= sunset) {
      return true;
    }
  }
  return false;
}

function getCurrentLocalHourString(offsetSeconds: number): string {
  const now = new Date();
  const localMillis = now.getTime() + offsetSeconds * 1000;
  return formatHour(new Date(localMillis));
}

function formatHour(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}`;
}

function findStartIndex(times: string[], currentHour: string, windowDays: number): number {
  const idx = times.findIndex((time) => time >= currentHour);
  if (idx !== -1) {
    return idx;
  }
  const fallbackPoints = windowDays * HOURS_IN_DAY;
  return Math.max(times.length - fallbackPoints, 0);
}

function toUnixTimestamp(timeStr: string, offsetSeconds: number): number {
  const parsed = new Date(`${timeStr}Z`).getTime();
  if (Number.isNaN(parsed)) {
    return Math.floor(Date.now() / 1000);
  }
  return Math.floor((parsed - offsetSeconds * 1000) / 1000);
}

function calculateWetFlag(idx: number, rainSeries: number[], precipitationSeries: number[]): number {
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

function calculateIceFlag(wetFlag: number, temperatureCelsius: number | undefined): number {
  if (wetFlag <= 0) {
    return 0;
  }
  if (typeof temperatureCelsius !== 'number' || Number.isNaN(temperatureCelsius)) {
    return 0;
  }
  return temperatureCelsius <= -1 ? 1 : 0;
}

function calculateSunIntensity(timeStr: string, sunrises: string[], sunsets: string[]): number {
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
      const sunriseHour = parseIsoHour(sunrise);
      const sunsetHour = parseIsoHour(sunset);
      const timeHour = parseIsoHour(timeStr);
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

function parseIsoHour(timeStr: string): number {
  if (!timeStr || timeStr.length < 16) {
    return 0;
  }
  const hour = Number(timeStr.substring(11, 13)) || 0;
  const minute = Number(timeStr.substring(14, 16)) || 0;
  return hour + minute / 60;
}

function calculateDewPoint(temperature: number, humidity: number): number {
  const safeHumidity = clampPercentage(humidity);
  const bPositive = 17.368;
  const cPositive = 238.88;
  const bNegative = 17.966;
  const cNegative = 247.15;

  const b = temperature > 0 ? bPositive : bNegative;
  const c = temperature > 0 ? cPositive : cNegative;

  const pa = (safeHumidity / 100.0) * Math.exp((b * temperature) / (c + temperature));
  return (c * Math.log(pa)) / (b - Math.log(pa));
}

function calculateCyclingComfortLevel(
  temperature: number,
  dewPoint: number,
  windSpeed: number,
  precipitation: number,
  humidity: number,
  solarRadiation: number,
  sensitivity: string,
  intensity: number
): number {
  let score = 10;

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

  if (dewPoint <= 10) {
    score += 1;
  } else if (dewPoint <= 16) {
    const penalty = dewPoint <= 13 ? 0 : -1;
    score += penalty;
  } else if (dewPoint <= 19) {
    score -= 2;
  } else if (dewPoint <= 22) {
    score -= 3;
  } else if (dewPoint <= 25) {
    score -= 4;
  } else {
    score -= 5;
  }

  if (windSpeed > 25) {
    score -= 3;
  } else if (windSpeed >= 15) {
    score -= 1;
  } else if (windSpeed >= 5 && temperature > 25 && dewPoint > 16) {
    score += 1;
  }

  if (precipitation > 10) {
    score -= 5;
  } else if (precipitation >= 5) {
    score -= 3;
  } else if (precipitation >= 1) {
    score -= 1;
  }

  if (temperature < 10 && solarRadiation > 300) {
    score += 2;
  } else if (temperature < 20 && solarRadiation > 500) {
    score += 1;
  } else if (temperature > 28 && solarRadiation > 400) {
    score -= 2;
  } else if (temperature > 25 && solarRadiation > 300) {
    score -= 1;
  }

  if (dewPoint > 18 && solarRadiation > 400 && windSpeed < 10 && temperature > 25) {
    score -= 1;
  }
  if (dewPoint > 21 && solarRadiation > 500 && windSpeed < 5 && temperature > 28) {
    score -= 2;
  }

  if (sensitivity.toLowerCase() === 'heatsensitive') {
    if (dewPoint > 16) {
      score -= 1;
    }
    if (temperature > 28) {
      score -= 1;
    }
  } else if (sensitivity.toLowerCase() === 'coldsensitive') {
    if (temperature < 10) {
      score -= 1;
    }
    if (windSpeed > 15) {
      score -= 1;
    }
  }

  if (dewPoint > 22 && temperature > 30) {
    const penalty = intensity === 2 ? -4 : intensity === 1 ? -3 : -2;
    score += penalty;
  } else if (dewPoint > 19 && temperature > 28) {
    const penalty = intensity === 2 ? -3 : intensity === 1 ? -2 : -1;
    score += penalty;
  }

  score = Math.max(1, Math.min(score, 10));
  return score * 10;
}

function calculateApparentTemperature(temperature: number, humidity: number, windSpeedKmh: number): number {
  const ta = temperature;
  const rh = clampPercentage(humidity);
  const windMs = Math.max(0, windSpeedKmh) / 3.6;
  const vaporPressure = (rh / 100) * 6.105 * Math.exp((17.27 * ta) / (237.7 + ta));
  const apparent = ta + 0.33 * vaporPressure - 0.7 * windMs - 4.0;
  return round(apparent, 1);
}

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

function round(value: number, decimals: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
