import React, { useEffect, useState } from 'react';
import { getBackendSrv } from '@grafana/runtime';

export function PageOne() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const pluginId = 'weacodi-weacodi-app';
    const routeAlias = 'weacodi-api';
    const apiEndpoint = '/api/v1/weather';

    const params = new URLSearchParams({
      lat: '52.52',
      lon: '13.40',
      days: '4',
      sensitivity: 'normal',
      intensity: '0',
    });

    const url = `/api/plugins/${pluginId}/routes/${routeAlias}${apiEndpoint}?${params.toString()}`;

    getBackendSrv()
      .fetch({ url, method: 'GET' })
      .subscribe({
        next: (response) => {
          setResult(response.data);
          setLoading(false);
        },
        error: (err) => {
          setError(err.data?.message || err.statusText);
          setLoading(false);
        },
      });
  }, []);

  return (
    <div>
      <h2>Weacodi API End-to-End Test (Page One)</h2>
      <p>
        This component queries <code>{result ? result.url : '...'}</code>
      </p>

      {loading && <p>Loading data from the API (http://weacodi-api:8080)...</p>}

      {error && (
        <>
          <h3 style={{ color: 'red' }}>Error</h3>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </>
      )}

      {result && (
        <>
          <h3>Success! JSON received from the API:</h3>
          <pre style={{ background: '#f4f4f4', padding: '10px', maxHeight: '400px', overflow: 'auto' }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </>
      )}
    </div>
  );
}
