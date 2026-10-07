#!/bin/bash
# Run as root after verifying administrative SSH on port 22222.
set -euo pipefail
archive=${1:-/tmp/s9v10-terminal.tar.gz}
command -v node-22 >/dev/null
command -v npm-22 >/dev/null
id s9v10 >/dev/null 2>&1 || useradd --system --home-dir /var/lib/s9v10-terminal --shell /sbin/nologin s9v10
install -d -m 755 /opt/s9v10-terminal
tar --no-same-owner -xzf "$archive" -C /opt/s9v10-terminal
cd /opt/s9v10-terminal
npm-22 ci --omit=dev --omit=optional --ignore-scripts
chown -R root:root /opt/s9v10-terminal
chmod -R a+rX /opt/s9v10-terminal
install -m 644 deploy/s9v10-terminal.service /etc/systemd/system/s9v10-terminal.service
printf 'Port 22222\nPasswordAuthentication no\nPermitRootLogin no\n' > /etc/ssh/sshd_config.d/00-s9v10.conf
sshd -t
systemctl restart sshd
systemctl daemon-reload
systemctl enable s9v10-terminal
systemctl restart s9v10-terminal
systemctl --no-pager --full status s9v10-terminal
