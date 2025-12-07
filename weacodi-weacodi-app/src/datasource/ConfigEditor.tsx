import React from 'react';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { Alert } from '@grafana/ui';
import { MyDataSourceOptions } from './types';

export function ConfigEditor(_: DataSourcePluginOptionsEditorProps<MyDataSourceOptions>) {
  return (
    <div className="gf-form-group">
      <Alert title="Open-Meteo only" severity="info">
        The Weacodi datasource connects directly to the public Open-Meteo API. This version does not expose
        per-datasource settings.
      </Alert>
    </div>
  );
}
