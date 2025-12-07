import { DataQuery, DataSourceJsonData } from '@grafana/data';

export interface MyQuery extends DataQuery {
  lat?: string;
  lon?: string;
  days?: number;
  sensitivity?: 'normal' | 'heatSensitive' | 'coldSensitive';
  intensity?: 0 | 1 | 2;
  units?: 'metric' | 'imperial' | 'nautical';
}

export interface MyDataSourceOptions extends DataSourceJsonData {
}
