# WeaCoDi Grafana Plugin

This directory contains the Grafana app plugin that renders the Weather Comfort
Diagram (WeaCoDi™) as a data source + visualization. It bundles:

- a backend datasource that queries the `weacodi-core-api` Fastify service,
- a front-end React panel that draws the layered comfort diagram, and
- provisioning files for a ready-to-use Grafana instance.

The plugin is already wired to the API when you run `docker compose up` from the
repository root, but you can build it independently as well.

## Build

```bash
nvm use 22              # or any Node.js >= 22 runtime
npm install
$(go env GOPATH)/bin/mage -v   # build backend binaries
npm run build                  # bundle the front-end panel
```

Artifacts land in `dist/`. Use `npm run dev` for watch-mode development or
`npm run server` to start a local Grafana with the plugin mounted.

## Licensing

- **Plugin code** (this directory): licensed under the
  [GNU Affero General Public License v3.0](../LICENSE). Any modification or
  network deployment must provide end users with the corresponding source code.
- **WeaCoDi method & diagrams** (`../docs/weacodi-concept.pdf`): licensed under
  [CC BY-SA 4.0](../LICENSE_WEACODI.md) with attribution to Oleksii Zubovskyi
  and Olena Zubovska.

WeaCoDi™, Weacodi™, and related marks are claimed trademarks; do not use them
in product names or marketing without permission.
