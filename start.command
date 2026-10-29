#!/bin/bash
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js 22.18+ from https://nodejs.org then run this again."
  exit 1
fi
if [ ! -d node_modules/@comfyorg/sdk ]; then npm ci || exit 1; fi
echo "Open Ad Studio: http://127.0.0.1:8340/adstudio/journey.html"
npm start
