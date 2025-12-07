import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MutableDataFrame,
  FieldType,
  dateTime,
} from '@grafana/data';
import { MyQuery, MyDataSourceOptions } from './types';
import {
  buildWeacodiResponse,
  normalizeUnits,
  normalizeDays,
  OPEN_METEO_ENDPOINT,
  OPEN_METEO_HOURLY_FIELDS,
  OPEN_METEO_DAILY_FIELDS,
  WeaCoDiResponse,
  OpenMeteoResponse,
  Units,
  Sensitivity,
  ComfortIntensity,
} from '../lib/weacodi';

const CACHE_TTL_MS = 3 * 60 * 60 * 1000;

interface CacheEntry {
  data: WeaCoDiResponse;
  timestamp: number;
}

const responseCache = new Map<string, CacheEntry>();

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
  }

  public async query(options: DataQueryRequest<MyQuery>): Promise<DataQueryResponse> {
    const { targets } = options;
    const data: MutableDataFrame[] = [];

    for (const target of targets) {
      if (target.hide) {
        continue;
      }

      const lat = this.parseCoordinate(target.lat, 52.52);
      const lon = this.parseCoordinate(target.lon, 13.4);
      const sensitivity = this.normalizeSensitivity(target.sensitivity);
      const intensity = this.normalizeIntensity(target.intensity);
      const units = normalizeUnits(target.units);
      const windowDays = normalizeDays(target.days);

      const cacheKey = this.buildCacheKey(lat, lon, windowDays, sensitivity, intensity, units);
      const now = Date.now();

      const cached = responseCache.get(cacheKey);
      if (cached && now - cached.timestamp < CACHE_TTL_MS) {
        data.push(this.buildFrameFromResponse(target.refId, cached.data, units));
        continue;
      }

      const params = this.buildOpenMeteoParams(lat, lon, windowDays);
      const url = this.buildRequestUrl(params);

      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Open-Meteo request failed with status ${response.status}`);
        }
        const payload = (await response.json()) as OpenMeteoResponse;

        const apiData = buildWeacodiResponse(payload, {
          sensitivity,
          intensity,
          units,
          windowDays,
        });
        responseCache.set(cacheKey, { data: apiData, timestamp: now });
        data.push(this.buildFrameFromResponse(target.refId, apiData, units));
      } catch (err: any) {
        const message = err.data?.message || err.statusText || err.message || 'Failed to fetch data from Open-Meteo';
        return { data: [], error: { message } };
      }
    }

    return { data };
  }

  public async testDatasource() {
    const params = this.buildOpenMeteoParams(0, 0, 1);
    const url = this.buildRequestUrl(params);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Open-Meteo returned ${response.status}`);
      }

      return {
        status: 'success',
        message: 'Success: Connected to Open-Meteo',
      };
    } catch (err: any) {
      return {
        status: 'error',
        message: `Failed to connect to Open-Meteo: ${err?.message || 'Unexpected error'}`,
      };
    }
  }

  private buildOpenMeteoParams(lat: number, lon: number, windowDays: number): URLSearchParams {
    const params = new URLSearchParams({
      latitude: lat.toFixed(4),
      longitude: lon.toFixed(4),
      hourly: OPEN_METEO_HOURLY_FIELDS,
      daily: OPEN_METEO_DAILY_FIELDS,
      forecast_days: String(windowDays),
      past_days: '1',
      timezone: 'auto',
    });

    return params;
  }

  private buildRequestUrl(params: URLSearchParams): string {
    const baseUrl = OPEN_METEO_ENDPOINT;
    if (baseUrl.includes('?')) {
      return `${baseUrl}&${params.toString()}`;
    }
    return `${baseUrl}?${params.toString()}`;
  }

  private parseCoordinate(value: string | number | undefined, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return fallback;
  }

  private normalizeSensitivity(value: Sensitivity | undefined): Sensitivity {
    if (value === 'heatSensitive' || value === 'coldSensitive') {
      return value;
    }
    return 'normal';
  }

  private normalizeIntensity(value: ComfortIntensity | undefined): ComfortIntensity {
    if (value === 1 || value === 2) {
      return value;
    }
    return 0;
  }

  private buildCacheKey(
    lat: number,
    lon: number,
    windowDays: number,
    sensitivity: Sensitivity,
    intensity: ComfortIntensity,
    units: Units
  ): string {
    return [
      lat.toFixed(3),
      lon.toFixed(3),
      windowDays,
      sensitivity,
      intensity,
      units,
    ].join(':');
  }

  private buildFrameFromResponse(refId: string | undefined, apiData: WeaCoDiResponse, units: Units): MutableDataFrame {
    const temperature = Array.isArray(apiData.temperature) ? apiData.temperature : [];
    const wind = Array.isArray(apiData.wind) ? apiData.wind : [];
    const humidity = Array.isArray(apiData.humidity) ? apiData.humidity : [];
    const uv = Array.isArray(apiData.uv) ? apiData.uv : [];
    const feelsLike = Array.isArray(apiData.feelsLike) ? apiData.feelsLike : [];
    const wet = Array.isArray(apiData.wet) ? apiData.wet : [];
    const ice = Array.isArray(apiData.ice) ? apiData.ice : [];
    const pressure = Array.isArray(apiData.pressure) ? apiData.pressure : [];

    const temperatureUnit = units === 'imperial' ? 'fahrenheit' : 'celsius';
    const windUnit = units === 'imperial' ? 'velocitymph' : units === 'nautical' ? 'kt' : 'velocitykmh';
    const rainUnit = units === 'imperial' ? 'lengthin' : 'lengthmm';
    const pressureUnit = units === 'imperial' ? 'inHg' : 'hPa';
    const pressureDecimals = units === 'imperial' ? 2 : 0;
    const rainDecimals = units === 'imperial' ? 2 : 1;

    return new MutableDataFrame({
      refId,
      fields: [
        {
          name: 'time',
          type: FieldType.time,
          values: apiData.time.map((t: number) => dateTime(t * 1000).valueOf()),
        },
        { name: 'daylight', type: FieldType.number, values: apiData.daylight },
        { name: 'sun', type: FieldType.number, values: apiData.sun },
        { name: 'clouds', type: FieldType.number, values: apiData.clouds },
        {
          name: 'rain',
          type: FieldType.number,
          values: apiData.rain,
          config: { unit: rainUnit, decimals: rainDecimals, min: 0 },
        },
        {
          name: 'snow',
          type: FieldType.number,
          values: apiData.snow,
          config: { unit: rainUnit, decimals: rainDecimals, min: -1 },
        },
        {
          name: 'temperature',
          type: FieldType.number,
          values: temperature,
          config: { unit: temperatureUnit },
        },
        {
          name: 'humidity',
          type: FieldType.number,
          values: humidity,
          config: { unit: 'percent', decimals: 0 },
        },
        {
          name: 'uv',
          type: FieldType.number,
          values: uv,
          config: { unit: 'none', decimals: 0 },
        },
        {
          name: 'feels_like',
          type: FieldType.number,
          values: feelsLike,
          config: { unit: temperatureUnit },
        },
        {
          name: 'wet',
          type: FieldType.number,
          values: wet,
          config: { unit: 'none', decimals: 0, min: 0, max: 1 },
        },
        {
          name: 'ice',
          type: FieldType.number,
          values: ice,
          config: { unit: 'none', decimals: 0, min: 0, max: 1 },
        },
        {
          name: 'pressure',
          type: FieldType.number,
          values: pressure,
          config: { unit: pressureUnit, decimals: pressureDecimals },
        },
        {
          name: 'comfort',
          type: FieldType.number,
          values: apiData.comfort,
          config: { unit: 'none' },
        },
        {
          name: 'wind',
          type: FieldType.number,
          values: wind,
          config: { unit: windUnit },
        },
      ],
    });
  }
}
