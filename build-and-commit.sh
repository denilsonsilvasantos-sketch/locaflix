#!/usr/bin/env bash
set -e

echo "Building frontend..."
npx vite build --config vite.app.config.ts

echo "Building server..."
npx esbuild server/index.ts --platform=node --target=node20 --outfile=dist/server/index.js --format=esm --packages=external

echo "Staging dist/..."
git add dist/

if git diff --cached --quiet; then
  echo "No changes in dist/ — nothing to commit."
else
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
  git commit -m "build: atualizar dist ($TIMESTAMP)"
  git push
  echo "Done — dist pushed."
fi
