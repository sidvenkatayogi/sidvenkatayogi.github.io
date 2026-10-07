#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
archive=$(mktemp /tmp/s9v10-terminal.XXXXXX)
trap 'rm -f "$archive"' EXIT
npm run build
COPYFILE_DISABLE=1 tar --no-xattrs -czf "$archive" package.json package-lock.json src content deploy/install.sh deploy/s9v10-terminal.service
options=(-i .state/lightsail_admin -o HostKeyAlias=s9v10-admin -o UserKnownHostsFile=.state/known_hosts -o StrictHostKeyChecking=yes)
scp "${options[@]}" -P 22222 "$archive" ec2-user@3.147.94.53:/tmp/s9v10-terminal.tar.gz
scp "${options[@]}" -P 22222 deploy/install.sh ec2-user@3.147.94.53:/tmp/s9v10-install.sh
ssh "${options[@]}" -p 22222 ec2-user@3.147.94.53 'sudo bash /tmp/s9v10-install.sh'
