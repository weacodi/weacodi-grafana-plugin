# Weacodi Grafana Plugin

Weacodi (Weather Comfort Diagram) renders a layered weather forecast directly in Grafana. The plugin calls the public [Open‑Meteo](https://open-meteo.com) API via the Grafana data proxy, processes the payload locally, and draws daylight, sun, clouds, rain, snow, wind, comfort score, wet/ice flags, UV and pressure on a single panel.

## Getting Started

In Grafana, create a datasource of type “Weacodi” named `weacodi` (no settings needed), then import `weacodi_dashboard.json` or `weacodi_cities_dashboard.json`.

## Features

- Layered Weather Comfort Diagram (daylight, sun, clouds, rain/snow, wind, comfort, wet/ice flags, feels-like, humidity, UV, pressure)
- Direct Open‑Meteo integration (no custom backend required)
- In-memory caching with a 3‑hour TTL per location and parameter set
- Reference dashboards for single-city and multi-city views

## Licensing & attribution

- **Plugin code**: [AGPL-3.0-only](https://www.gnu.org/licenses/agpl-3.0.en.html) (share-alike for the Grafana plugin code).
- **Weather Comfort Diagram concept, diagrams, content, documentation**: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

Project website: https://weacodi.com
