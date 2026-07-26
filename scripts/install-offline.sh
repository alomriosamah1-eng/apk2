#!/bin/bash
# Offline package installer for Khaznati
# This script installs dependencies from the npm cache without network access.
set -euo pipefail

echo "Installing dependencies from cache..."
npm install --prefer-offline --no-audit --no-fund
echo "Done."
