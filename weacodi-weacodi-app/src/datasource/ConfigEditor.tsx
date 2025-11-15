import React, { ChangeEvent } from 'react';
import { InlineField, Input, SecretInput } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { MyDataSourceOptions } from './types';

interface SecureJsonData {
  apiKey?: string;
}

export function ConfigEditor({ options, onOptionsChange }: DataSourcePluginOptionsEditorProps<MyDataSourceOptions>) {
  const { jsonData, secureJsonFields } = options;
  const secureJsonData = (options.secureJsonData || {}) as SecureJsonData;

  const onApiUrlChange = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...jsonData,
        apiUrl: event.target.value,
      },
    });
  };

  const onApiKeyChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    const nextSecureJsonFields = secureJsonFields ? { ...secureJsonFields, apiKey: false } : { apiKey: false };

    onOptionsChange({
      ...options,
      secureJsonData: {
        ...secureJsonData,
        apiKey: value,
      },
      secureJsonFields: nextSecureJsonFields,
    });
  };

  const onResetApiKey = () => {
    const nextSecureJsonFields = secureJsonFields ? { ...secureJsonFields, apiKey: false } : { apiKey: false };

    onOptionsChange({
      ...options,
      secureJsonData: {
        ...secureJsonData,
        apiKey: '',
      },
      secureJsonFields: nextSecureJsonFields,
    });
  };

  return (
    <div className="gf-form-group">
      <InlineField label="API URL" labelWidth={14} tooltip="Override the default WeaCoDi API endpoint">
        <Input
          width={40}
          value={jsonData.apiUrl || ''}
          onChange={onApiUrlChange}
          placeholder="http://weacodi-api:8080"
        />
      </InlineField>
      <InlineField label="API Key" labelWidth={14} tooltip="Optional bearer token forwarded to the WeaCoDi API">
        <SecretInput
          width={40}
          isConfigured={Boolean(secureJsonFields?.apiKey)}
          value={secureJsonData.apiKey || ''}
          placeholder="Optional API key"
          onChange={onApiKeyChange}
          onReset={onResetApiKey}
        />
      </InlineField>
    </div>
  );
}
