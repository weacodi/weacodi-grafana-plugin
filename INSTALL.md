# Installation Guide

This document explains how to set up the WeaCoDi stack for development or evaluation. The toolkit consists of three services:

1. **weacodi-core-api** – Fastify server that fetches weather data from [Open-Meteo](https://open-meteo.com/en/docs).
2. **Redis** – cache used by the API.
3. **Grafana** with the custom **weacodi-weacodi-app** plugin (data source + panel).

The quickest path is via Docker Compose. Manual installation steps are also documented for production use.

## Prerequisites

- Git
- Node.js **22.x** and npm **11.x** (required by Grafana plugin toolchain)
- Docker Desktop or Docker Engine **≥ 24** with Docker Compose v2
- (Optional) Grafana **≥ 10.4** if you want to integrate the plugin into an existing Grafana instance

## 1. Clone the repository

```bash
git clone https://github.com/weacodi/weacodi-grafana.git
cd weacodi-grafana
nvm install 22   # ensure Node.js >= 22
nvm use 22
```

## 2. Install dependencies

### Grafana plugin (`weacodi-weacodi-app`)

```bash
cd weacodi-weacodi-app
npm install
$(go env GOPATH)/bin/mage -v   # build backend binaries
npm run build                  # build frontend bundle
```

This creates the production-ready plugin bundle inside `dist/`. Docker Compose mounts this directory into Grafana.

### Core API (`weacodi-core-api`)

```bash
cd ../weacodi-core-api
npm install
```

> `npm run build` is optional when running the development setup (`npm run dev` is executed inside the container).

## 3. Configure environment variables

Create `weacodi-core-api/.env` if you need overrides. Defaults are sensible for local usage:

```
API_PORT=8080
REDIS_HOST=redis
REDIS_PORT=6379
CACHE_TTL_SECONDS=3600
```

`REDIS_HOST` is pre-set to the Compose service name, so you usually do not need to change it.

## 4. Launch via Docker Compose

From inside `weacodi-core-api/` run:

```bash
docker compose up --build
```

This spins up three services:

- `weacodi-api` (Fastify with hot reload).
- `redis` (Redis 7, with health checks).
- `grafana` (latest OSS image, admin password `weacodi`, unsigned plugin loading enabled).

Access Grafana at <http://localhost:3000/> and log in with `admin / weacodi`.

The stack mounts `../weacodi-weacodi-app/dist` into `/var/lib/grafana/plugins/weacodi-weacodi-app`, so once you build the plugin (`npm run build`) the container picks it up after a restart. The generated `dist/` folder is not tracked in git; each contributor should build locally.

## Manual installation (without Docker)

1. **Run Redis** (e.g., `redis-server --port 6379`).
2. **Start the API**:
   ```bash
   cd weacodi-core-api
   npm install
   npm run build   # optional for dev, required for production
   npm run start   # uses dist/server.js
   ```
   The service listens on `API_PORT` (default 8080).
3. **Install the Grafana plugin**:
   - Build the plugin (`npm run build`).
   - Copy the `dist/` folder to your Grafana plugin directory (`/var/lib/grafana/plugins/weacodi-weacodi-app` or `%ProgramData%\GrafanaLabs\grafana\data\plugins` on Windows).
   - Allow unsigned plugins by setting `GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=weacodi-weacodi-app,weacodi-weacodi-ds` in Grafana's configuration, or sign the plugin using `npm run sign`.
   - Restart Grafana.
4. **Create a data source** inside Grafana:
   - Type: *WeaCoDi Weather* (custom data source supplied by the plugin).
   - URL: `http://YOUR_API_HOST:8080/api/v1/weather`.

The reference dashboard (`weacodi_dashboard.json`) can then be imported via Grafana's *Dashboards → Import* dialog.

## Updating the plugin

1. Rebuild: `npm run build` inside `weacodi-weacodi-app`.
2. Restart Grafana (or the Docker container). Since the plugin is copied/mounted into the Grafana data directory, no extra steps are required.

## Upgrading dependencies

- API: run `npm update` within `weacodi-core-api`.
- Plugin: run `npm run lint`, `npm run typecheck`, and `npm test` to ensure compatibility with newer Grafana SDK versions before rebuilding.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Grafana says “Plugin unavailable” | Ensure the plugin bundle exists in `weacodi-weacodi-app/dist` **before** starting Grafana. Rebuild and restart if needed. |
| API responses return stale data | Clear Redis cache: `redis-cli FLUSHALL`. Cache TTL can be adjusted via `CACHE_TTL_SECONDS`. |
| Metric units look wrong | Overrides in Grafana take precedence over datasource configuration. Remove `unit` overrides if you want the datasource to control units dynamically. |
| Grafana cannot load plugin | Remember to allow unsigned plugins (`GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS`). |
| `npm install` fails with `patch-package: not found` | Run `npm install --save-dev patch-package --ignore-scripts` inside `weacodi-weacodi-app`, then rerun `npm install`. |

Need more help? Reach out at [weacodi@gmail.com](mailto:weacodi@gmail.com).
