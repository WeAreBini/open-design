#!/bin/sh
# We Are Bini change. Apache License 2.0. Copyright 2026 Open Design contributors.
# Do not start `od mcp`. That listener is loopback-only and must not be published.
set -eu
export PATH="/opt/hosted-clis/bin:${PATH}"
export OD_AGENT_HOME="${OD_AGENT_HOME:-/app/.od/agent-home}"
export DSH_HOME="${DSH_HOME:-${OD_AGENT_HOME}/.dsh}"
mkdir -p "$OD_AGENT_HOME" "$DSH_HOME" /app/.od

PROFILE="${DSH_HOME}/profiles/open-design"
BUNDLE="/app/agent-runtimes/deepseek-harness"
if [ ! -f "${PROFILE}/package.json" ] && [ -f "${BUNDLE}/manifest.json" ] && [ -x /opt/hosted-clis/bin/dsh ]; then
  saved_node_options="${NODE_OPTIONS-}"
  unset NODE_OPTIONS || true
  file_name="$(node -e 'const fs=require("node:fs"); const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(!/^[\w.+-]+\.tgz$/.test(m.file)) process.exit(1); process.stdout.write(m.file)' "${BUNDLE}/manifest.json")"
  mkdir -p "${PROFILE}/.open-design"
  cp "${BUNDLE}/${file_name}" "${PROFILE}/.open-design/${file_name}"
  if ! (cd "$PROFILE" && dsh plugin --profile open-design add ".open-design/${file_name}"); then
    echo "DeepSeek Harness profile install failed. The daemon will still start." >&2
  fi
  if [ -n "$saved_node_options" ]; then
    export NODE_OPTIONS="$saved_node_options"
  else
    export NODE_OPTIONS="--max-old-space-size=192"
  fi
fi

plugin_modules="${PROFILE}/node_modules/@open-design"
toolchain_modules="/opt/hosted-clis/dsh-runtime/node_modules"
if [ -d "$plugin_modules" ] && [ -d "$toolchain_modules" ] && [ ! -e "${toolchain_modules}/@open-design" ]; then
  ln -s "$plugin_modules" "${toolchain_modules}/@open-design"
fi

exec /usr/bin/tini -- "$@"
