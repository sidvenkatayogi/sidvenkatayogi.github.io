#!/bin/bash
set -euo pipefail
# Amazon Linux 2023, including a little swap for package installation on 512 MB.
if [ ! -f /swapfile ]; then
  fallocate -l 512M /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
dnf install -y nodejs22 nodejs22-npm
install -d -m 755 /opt/s9v10-terminal
# Keep administrative SSH on both ports until the deployment verifies port 22222.
printf 'Port 22\nPort 22222\nPasswordAuthentication no\nPermitRootLogin no\n' > /etc/ssh/sshd_config.d/00-s9v10.conf
sshd -t
systemctl restart sshd
