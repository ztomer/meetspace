#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

app_meetspace=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --app-meetspace)
      app_meetspace="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

if [[ -n "$app_meetspace" ]]; then
  "$SCRIPT_DIR/yabai_impl.sh" --bundle-id "$app_meetspace" --position left
fi
