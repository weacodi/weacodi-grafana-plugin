import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MutableDataFrame,
  FieldType,
  dateTime,
} from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';

import { MyQuery, MyDataSourceOptions } from './types';

interface WeaCoDiResponse {
  time: number[];
  daylight: number[];
  sun: number[];
  clouds: number[];
  rain: number[];
  snow: number[];
  comfort: number[];
  wind: number[];
  temperature?: number[];
  humidity?: number[];
  uv?: number[];
  feelsLike?: number[];
  wet?: number[];
  ice?: number[];
  pressure?: number[];
}

type SecretAwareSettings = DataSourceInstanceSettings<MyDataSourceOptions> & {
  decryptedSecureJsonData?: Record<string, string>;
};

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  private readonly settings: SecretAwareSettings;

  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
    this.settings = instanceSettings as SecretAwareSettings;
  }

  private buildRequestHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const apiUrl = this.settings.jsonData?.apiUrl?.trim();
    const apiKey = this.settings.decryptedSecureJsonData?.apiKey?.trim();

    if (apiUrl) {
      headers['X-WeaCoDi-Api-Url'] = apiUrl;
    }

    if (apiKey) {
      headers['X-WeaCoDi-Api-Key'] = apiKey;
    }

    return headers;
  }

  public async query(options: DataQueryRequest<MyQuery>): Promise<DataQueryResponse> {
    const { targets } = options;
    const data: MutableDataFrame[] = [];

    for (const target of targets) {
      if (target.hide) {
        continue;
      }

      const pluginId = 'weacodi-weacodi-app';
      const routeAlias = 'weacodi-api';
      const apiEndpoint = '/api/v1/weather';
      const requestedDays = Number.isFinite(target.days) ? Math.floor(target.days as number) : undefined;
      const units = target.units === 'imperial' || target.units === 'nautical' ? target.units : 'metric';

      const params = new URLSearchParams({
        lat: target.lat ?? '52.52',
        lon: target.lon ?? '13.40',
        sensitivity: target.sensitivity ?? 'normal',
        intensity: (target.intensity ?? 0).toString(),
        units,
      });

      if (requestedDays !== undefined && requestedDays > 0) {
        params.set('days', Math.min(16, requestedDays).toString());
      }

      const url = `/api/plugins/${pluginId}/resources/${routeAlias}${apiEndpoint}?${params.toString()}`;

      try {
        const response = await getBackendSrv()
          .fetch({ url, method: 'GET', headers: this.buildRequestHeaders() })
          .toPromise();
        if (!response) {
          throw new Error('No response received from WeaCoDi API');
        }

        const apiData = response.data as WeaCoDiResponse;
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

        const frame = new MutableDataFrame({
          refId: target.refId,
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

        data.push(frame);
      } catch (err: any) {
        const message = err.data?.message || err.statusText || err.message || 'Failed to fetch WeaCoDi data';
        return { data: [], error: { message } };
      }
    }

    return { data };
  }

  public async testDatasource() {
    const pluginId = 'weacodi-weacodi-app';
    const routeAlias = 'weacodi-api';
    const apiEndpoint = '/api/v1/weather';
    const url = `/api/plugins/${pluginId}/resources/${routeAlias}${apiEndpoint}?lat=0&lon=0&units=metric`;

    try {
      const response = await getBackendSrv()
        .fetch({ url, method: 'GET', headers: this.buildRequestHeaders() })
        .toPromise();
      if (!response) {
        throw new Error('No response received from WeaCoDi API');
      }

      return {
        status: 'success',
        message: 'Success: Connected to WeaCoDi API',
      };
    } catch (err: any) {
      return {
        status: 'error',
        message: `Failed to connect to WeaCoDi API: ${err.statusText || err.data?.message || err.message}`,
      };
    }
  }

}
