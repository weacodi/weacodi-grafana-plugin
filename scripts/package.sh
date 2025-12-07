#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$REPO_ROOT/weacodi-weacodi-app"
DIST_DIR="$APP_DIR/dist"
PLUGIN_ID="weacodi-weacodi-app"
VERSION="$(node -p "require('$APP_DIR/package.json').version")"
STAGING_DIR="$REPO_ROOT/pkg/$PLUGIN_ID"
ZIP_PATH="$REPO_ROOT/${PLUGIN_ID}-${VERSION}.zip"

if [[ ! -d "$DIST_DIR" ]]; then
  echo "Dist directory not found at $DIST_DIR. Run npm run build first." >&2
  exit 1
fi

rm -rf "$REPO_ROOT/pkg" "$ZIP_PATH"
mkdir -p "$STAGING_DIR"
cp -a "$DIST_DIR/." "$STAGING_DIR/"

# Ensure we keep full metadata for the app and nested datasource
# (dist/plugin.json and dist/datasource/plugin.json are minimized by the
# build toolchain and may drop logos / includes that the catalog expects).
if [[ -f "$APP_DIR/src/plugin.json" ]]; then
  cp "$APP_DIR/src/plugin.json" "$STAGING_DIR/plugin.json"
fi

if [[ -f "$APP_DIR/src/datasource/plugin.json" ]]; then
  mkdir -p "$STAGING_DIR/datasource"
  cp "$APP_DIR/src/datasource/plugin.json" "$STAGING_DIR/datasource/plugin.json"
fi

# Include metadata files expected by Grafana catalog
for file in package.json package-lock.json README.md LICENSE NOTICE; do
  if [[ -f "$APP_DIR/$file" ]]; then
    cp "$APP_DIR/$file" "$STAGING_DIR/$file"
  fi
done

(cd "$REPO_ROOT/pkg" && zip -qr "$ZIP_PATH" "$PLUGIN_ID")

echo "Created $ZIP_PATH"
