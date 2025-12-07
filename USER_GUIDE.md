# Weacodi Grafana User Guide

This document explains how to work with the Weacodi dashboard and the accompanying Grafana data source.

## Getting started

After importing `weacodi_dashboard.json` (or running the Docker Compose setup) you will find a **Weacodi** dashboard ready to use. The panel already points at the bundled Weacodi datasource, so you can immediately change the query parameters from the panel editor.

### Datasource query options

| Field           | Description                                                                                   |
|-----------------|-----------------------------------------------------------------------------------------------|
| **Latitude / Longitude** (`lat`, `lon`) | Geographic coordinates. Any decimal degree coordinate is supported. |
| **Sensitivity** (`sensitivity`) | Fine-tunes the comfort calculation. Options: `Normal`, `Heat Sensitive`, `Cold Sensitive`. |
| **Intensity** (`intensity`) | Cycling effort profile (0 – recreational, 1 – commute, 2 – active). Exposed in the API only; you can add it via the query JSON editor if needed. |
| **Units** (`units`) | Rendering units: `Metric`, `Imperial`, or `Nautical (knots)`. Metric is the default. |
| **Days** (`days`) | Optional. If omitted, the datasource returns the full 16-day window supplied by Open-Meteo. Provide an integer 1…16 to trim the forecast. |

When you change a value, Grafana automatically runs the query and refreshes the panel.

## Fields returned by the API

All series share the same timestamps (`time` array). Depending on the chosen unit system the numerical values are converted server-side before reaching Grafana.

| Field            | Meaning                                                                 | Unit (metric / imperial / nautical)             |
|------------------|-------------------------------------------------------------------------|------------------------------------------------|
| `daylight`       | 0–100 % step function indicating day/night progression                  | %                                              |
| `sun`            | Computed sunlight intensity                                             | %                                              |
| `clouds`         | Total cloud cover                                                       | %                                              |
| `rain`           | Precipitation (combined intensity)                                      | mm / in / mm                                   |
| `snow`           | Snowfall amount (converted from Open-Meteo snowfall to millimetres; `-1` means “no snow”) | millimetres (`mm`)                             |
| `comfort`        | Weacodi comfort index (scaled from 0 to 100)                            | %                                              |
| `wind`           | Wind speed                                                              | km/h / mph / knots                             |
| `temperature`    | Air temperature                                                         | °C / °F / °C                                   |
| `humidity`       | Relative humidity                                                       | %                                              |
| `uv`             | UV index                                                                | index                                          |
| `feelsLike`      | Apparent temperature (wind + humidity adjusted)                         | °C / °F / °C                                   |
| `wet`            | Binary indicator (0 dry, 1 wet) derived from recent precipitation       | flag                                           |
| `ice`            | Potential icing risk (wet surface combined with ≤ -1 °C air temperature) | flag                                           |
| `pressure`       | Surface pressure                                                        | hPa / inHg / hPa                               |

### Wet surface indicator

`wet` becomes `1` when either:
- It is currently precipitating (rain or combined precipitation ≥ 0.1), or
- The running sum of the last 12 hours of precipitation surpasses 0.8 mm/in, or
- The running sum of the last 24 hours surpasses 2 mm/in.

Otherwise the value drops to `0` (dry).

### Icing indicator

`ice` flips to `1` whenever the surface is wet (`wet = 1`) **and** the ambient temperature is at or below −1 °C. It stays `0` otherwise.

## Adjusting visual appearance

Each series ships with an override that exposes the following knobs through Grafana’s UI:

- **Line width**
- **Fill opacity**
- **Hide in legend / tooltip / visualization**
- **Axis placement**
- **Line interpolation**
- **Min / Max**
- **Color scheme (single color)**
- **Display name**
- **Decimals**
- **Unit**

You can adopt different palettes or ranges simply by editing these overrides (Panel → Field → Overrides). Remember that specifying a `unit` override will override whatever unit the datasource emits (useful if you want to lock a series to a specific unit).

## Time range

The dashboard default is `now → now + 16d` to match the API’s maximum forecast window. You can change the time picker to review a shorter slice (e.g., 5 days) or zoom into specific hours. When you adjust the time picker the panel automatically refreshes.

## Tooltips and legend

- Hovering the diagram shows the exact values of all visible series at a given timestamp.
- The legend can be expanded to display mean / min / max values. Use Grafana’s legend settings if you want additional statistics.
- Click a series name in the legend to hide/show it without editing overrides.

## Exporting data

Use **Inspect → Data → Download CSV** from the panel menu to download the current result set for offline analysis.

## Upstream data source

All weather data is provided by [Open-Meteo](https://open-meteo.com/en/docs), a free, no-auth weather API. The Weacodi Grafana datasource adds in-memory caching, unit conversion and derived fields on top of the raw Open-Meteo forecast.

## Need help?

For support or feature ideas reach out at <mailto:weacodi@gmail.com> or open an issue in the repository.
