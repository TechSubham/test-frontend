#!/bin/sh
# Writes the browser runtime config at container start (run by the nginx image entrypoint).
# Only public, non-secret values belong here: it is served to every browser.
set -eu

out_dir="${LYFTR_RUNTIME_DIR:-/tmp/lyftr-runtime}"
mkdir -p "$out_dir"

json_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/</\\u003c/g' | tr -d '\n\r'
}

api="${API_BASE_URL:-}"
case "$api" in
  "" | http://* | https://*) ;;
  *)
    echo "lyftr: ignoring API_BASE_URL='$api' (must start with http:// or https://)" >&2
    api=""
    ;;
esac
api="${api%/}"

# The browser — not another container — calls this URL, so Docker-internal service names
# (resolvable only on the Compose network) would always fail. Reject them loudly.
host="${api#*://}"
host="${host%%/*}"
host="${host%%:*}"
case "$host" in
  backend | frontend | fake-llm)
    echo "lyftr: ignoring API_BASE_URL='$api' — '$host' is a Docker-internal name the browser cannot reach; use e.g. http://localhost:8000" >&2
    api=""
    ;;
esac

tmp="$out_dir/env.js.tmp"
printf 'window.__ENV__ = { API_BASE_URL: "%s" };\n' "$(json_escape "$api")" > "$tmp"
mv "$tmp" "$out_dir/env.js"
echo "lyftr: runtime config API_BASE_URL=${api:-<build-time default>}"
