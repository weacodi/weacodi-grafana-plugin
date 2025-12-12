# Weacodi Grafana Plugin

Weacodi (Weather Comfort Diagram) renders a layered weather forecast directly in Grafana. The plugin calls the public [Open‑Meteo](https://open-meteo.com) API via the Grafana data proxy, processes the payload locally, and draws daylight, sun, clouds, rain, snow, wind, comfort score, wet/ice flags, UV and pressure on a single panel.

## Getting Started

1) Build the plugin

```bash
nvm use 22              # or any Node.js >= 22 runtime
npm install
npm run build
```

2) Run Grafana locally

```bash
npm run server
```

3) In Grafana, create a datasource of type “Weacodi” named `weacodi` (no settings needed). When you enable the app,
the bundled dashboard **Weacodi – Overview** (from `dashboards/weacodi_overview.json`) is imported automatically; you can
also import it manually via *Dashboards → Import*.

## Features

- Layered Weather Comfort Diagram (daylight, sun, clouds, rain/snow, wind, comfort, wet/ice flags, feels-like, humidity, UV, pressure)
- Direct Open‑Meteo integration (no custom backend required)
- In-memory caching with a 3‑hour TTL per location and parameter set
- Reference dashboards for single-city and multi-city views

## Licensing & attribution

- **Plugin code**: [AGPL-3.0-only](https://github.com/weacodi/weacodi-grafana-plugin/blob/main/LICENSE) (share-alike for the Grafana plugin code).
- **Weather Comfort Diagram concept, diagrams, content, documentation** ([docs/weacodi-concept.pdf](https://github.com/weacodi/weacodi-grafana-plugin/blob/main/docs/weacodi-concept.pdf)): [CC BY-SA 4.0](https://github.com/weacodi/weacodi-grafana-plugin/blob/main/LICENSE_WEACODI.md).

Project website: https://weacodi.com
