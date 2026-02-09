#!/usr/bin/env bash
# CLI wrapper: assistant "plan my day"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
exec npx tsx "$DIR/src/cli.ts" "$@"
