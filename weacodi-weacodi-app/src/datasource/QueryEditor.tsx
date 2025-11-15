import React, { ChangeEvent } from 'react';
import { InlineField, Input, Select } from '@grafana/ui';
import { QueryEditorProps } from '@grafana/data';
import { DataSource } from './DataSource';
import { MyDataSourceOptions, MyQuery } from './types';

type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

export function QueryEditor({ query, onChange, onRunQuery }: Props) {
  const onLatChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, lat: event.target.value });
    onRunQuery();
  };

  const onLonChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, lon: event.target.value });
    onRunQuery();
  };

  const onSensitivityChange = (value: 'normal' | 'heatSensitive' | 'coldSensitive') => {
    onChange({ ...query, sensitivity: value });
    onRunQuery();
  };

  const onUnitsChange = (value: 'metric' | 'imperial' | 'nautical') => {
    onChange({ ...query, units: value });
    onRunQuery();
  };

  const { lat, lon, sensitivity, units } = query;

  return (
    <div className="gf-form">
      <InlineField label="Latitude" labelWidth={14}>
        <Input width={16} onChange={onLatChange} value={lat || ''} placeholder="e.g. 52.52" />
      </InlineField>
      <InlineField label="Longitude" labelWidth={14}>
        <Input width={16} onChange={onLonChange} value={lon || ''} placeholder="e.g. 13.40" />
      </InlineField>
      <InlineField label="Sensitivity" labelWidth={14}>
        <Select
          width={20}
          options={[
            { label: 'Normal', value: 'normal' },
            { label: 'Heat Sensitive', value: 'heatSensitive' },
            { label: 'Cold Sensitive', value: 'coldSensitive' },
          ]}
          value={sensitivity || 'normal'}
          onChange={(v) => onSensitivityChange(v.value as any)}
        />
      </InlineField>
      <InlineField label="Units" labelWidth={14}>
        <Select
          width={20}
          options={[
            { label: 'Metric', value: 'metric' },
            { label: 'Imperial', value: 'imperial' },
            { label: 'Nautical (knots)', value: 'nautical' },
          ]}
          value={units || 'metric'}
          onChange={(v) => onUnitsChange((v.value as 'metric' | 'imperial' | 'nautical') ?? 'metric')}
        />
      </InlineField>
    </div>
  );
}
