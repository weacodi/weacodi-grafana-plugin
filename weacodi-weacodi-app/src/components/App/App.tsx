import React from 'react';
import { PluginPage } from '@grafana/runtime';
import pluginJson from '../../plugin.json';

function App() {
  return (
    <PluginPage>
      <div>
        <h2>{pluginJson.name}</h2>
        <p>
          The Weacodi app bundles the Weacodi datasource and a ready-made dashboard so you can visualize the Weather
          Comfort Diagram without extra setup.
        </p>
        <ul>
          <li>
            Datasource type: <code>Weacodi</code> (name it <code>weacodi</code> to match the bundled dashboard; uses
            Open-Meteo via the Grafana data proxy).
          </li>
          <li>
            Dashboard: <strong>Weacodi – Overview</strong> imports automatically when the app is enabled.
          </li>
          <li>No app configuration is required in this release.</li>
        </ul>
      </div>
    </PluginPage>
  );
}

export default App;
