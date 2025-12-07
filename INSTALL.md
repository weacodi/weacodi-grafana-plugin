# Installation Guide

This document explains how to set up the Weacodi Grafana plugin for development or evaluation. The plugin now talks directly to Open-Meteo and only requires the `weacodi-weacodi-app/` directory.

## Prerequisites

- Git
- Node.js **22.x** and npm **11.x** (required by Grafana plugin toolchain)
- (Optional) Docker Desktop or Docker Engine **≥ 24** with Docker Compose v2 if you want to use the development stack under `weacodi-weacodi-app/`
- Grafana **≥ 10.4** if you want to integrate the plugin into an existing Grafana instance

## 1. Clone the repository

```bash
git clone https://github.com/weacodi/weacodi-grafana-plugin.git
cd weacodi-grafana-plugin
nvm install 22   # ensure Node.js >= 22
nvm use 22
```

## 2. Install dependencies

```bash
cd weacodi-weacodi-app
npm install
npm run build                  # build frontend bundle
```

This creates the production-ready plugin bundle inside `dist/`.

## 3. Install via Docker Compose (recommended for evaluation)

```bash
cd weacodi-weacodi-app
npm run server   # wraps "docker compose up --build"
```

This command spins up Grafana 12.2.0 with the plugin already mounted (`dist/` is bind-mounted into `/var/lib/grafana/plugins/weacodi-weacodi-app`), provisions the `weacodi` datasource, and exposes Grafana at <http://localhost:3000> (admin/admin on first boot). Skip to the dashboard import step once Grafana is up.

## 4. Install the Grafana plugin manually (without Docker)

If you want to install the plugin into an existing Grafana instance, follow the steps below:

## 3. Install the Grafana plugin (without Docker)

1. **Install the plugin into Grafana**:
   - Build the plugin (`npm run build`).
   - Copy the `dist/` folder to your Grafana plugin directory (`/var/lib/grafana/plugins/weacodi-weacodi-app` or `%ProgramData%\GrafanaLabs\grafana\data\plugins` on Windows). Create the folder if it doesn't exist:
     ```bash
     sudo mkdir -p /var/lib/grafana/plugins/weacodi-weacodi-app
     sudo cp -r dist/* /var/lib/grafana/plugins/weacodi-weacodi-app/
     sudo chown -R grafana:grafana /var/lib/grafana/plugins/weacodi-weacodi-app
     ```
   - Allow unsigned plugins by setting `GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=weacodi-weacodi-app,weacodi` in Grafana's configuration, or sign the plugin using `npm run sign`.
   - Restart Grafana.
2. **Create a data source** inside Grafana:
   - Type: *Weacodi* (custom data source supplied by the plugin).
   - Name: `weacodi`.
   - No additional configuration is required; the datasource connects directly to Open-Meteo.

The reference dashboards (`weacodi_dashboard.json` and `weacodi_cities_dashboard.json`) can then be imported manually via Grafana's *Dashboards → Import* dialog. As long as the datasource is named `weacodi`, the panels will bind to it automatically.

## Updating the plugin

1. Rebuild: `npm run build` inside `weacodi-weacodi-app`.
2. Restart Grafana (or the Docker container). Since the plugin is copied/mounted into the Grafana data directory, no extra steps are required.

## Upgrading dependencies

- Plugin: run `npm run lint`, `npm run typecheck`, and `npm test` to ensure compatibility with newer Grafana SDK versions before rebuilding.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Grafana says “Plugin unavailable” | Ensure the plugin bundle exists in `weacodi-weacodi-app/dist` **before** starting Grafana. Rebuild and restart if needed. |
| Datasource “weacodi” missing after start | Enable the Weacodi app plugin in Grafana and restart. Provisioning only runs once, so disable/re-enable the plugin or create the datasource manually if needed. |
| Metric units look wrong | Overrides in Grafana take precedence over datasource configuration. Remove `unit` overrides if you want the datasource to control units dynamically. |
| Grafana cannot load plugin | Remember to allow unsigned plugins (`GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=weacodi-weacodi-app,weacodi`). |
| `npm install` fails with `patch-package: not found` | Run `npm install --save-dev patch-package --ignore-scripts` inside `weacodi-weacodi-app`, then rerun `npm install`. |

Need more help? Reach out at [weacodi@gmail.com](mailto:weacodi@gmail.com).
