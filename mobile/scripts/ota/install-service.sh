#!/usr/bin/env bash
# Installs the update server as a systemd user service, torrential-ota, on the Linux machine the phones
# reach over Tailscale. It copies server.ts out of this checkout (run it again after changing the
# server), so the service doesn't depend on a branch or worktree staying checked out. The server binds
# only to the Tailscale address, so nothing outside the tailnet can reach it; until Tailscale is up the
# bind fails and systemd retries every 5 seconds. Needs Node 22 or newer, and lingering
# (`loginctl enable-linger`) to run without a login.
#
#   mobile/scripts/ota/install-service.sh            then: journalctl --user -u torrential-ota -f
#
# OTA_HOST (default: `tailscale ip -4`), OTA_PORT (8790) and OTA_DIR (~/.local/share/torrential-ota)
# change where it listens and what it serves.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
node=$(command -v node)
"$node" -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)' ||
  { echo "install-service.sh: needs Node 22 or newer (nvm use 22)" >&2; exit 1; }
host=${OTA_HOST:-$(tailscale ip -4 | head -1)}
port=${OTA_PORT:-8790}
dir=${OTA_DIR:-$HOME/.local/share/torrential-ota}
lib=$HOME/.local/lib/torrential-ota
unit=$HOME/.config/systemd/user/torrential-ota.service

mkdir -p "$lib" "$dir" "$(dirname "$unit")"
cp "$here/server.ts" "$here/package.json" "$lib/"
cat >"$unit" <<UNIT
[Unit]
Description=Over-the-air updates for torrential preview, on Tailscale only
After=network-online.target

[Service]
Environment=OTA_HOST=$host OTA_PORT=$port OTA_DIR=$dir
ExecStart=$node $lib/server.ts
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
UNIT
systemctl --user daemon-reload
systemctl --user enable torrential-ota.service >/dev/null 2>&1
systemctl --user restart torrential-ota.service
echo "torrential-ota: http://$host:$port/manifest serving $dir"
