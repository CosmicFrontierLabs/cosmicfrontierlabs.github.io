#!/usr/bin/env bash
set -euo pipefail

echo "Building site..."
npm run build

echo "Deploying dist/ to cf-temp on Netlify..."
netlify deploy --dir=dist --site=cf-temp --prod

echo "Done!"
