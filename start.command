#!/bin/sh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js 22.18 or newer from https://nodejs.org, then reopen this file."
  printf "Press Enter to close. "
  read -r answer
  exit 1
fi
node adstudio/scripts/launch.mjs
result=$?
if [ "$result" -ne 0 ]; then
  printf "Press Enter to close. "
  read -r answer
fi
exit "$result"
