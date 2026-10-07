#!/bin/bash
# Build and deploy only the HTTPS landing page, without rebuilding the SSH app.
set -euo pipefail
cd "$(dirname "$0")/../../.."
work=$(mktemp -d /tmp/s9v10-web-deploy.XXXXXX)
trap 'rm -rf "$work"' EXIT
node terminal/deploy/web/build.mjs "$work/site"
cp terminal/deploy/web/{Caddyfile,install.sh,s9v10-web.service} "$work/"
COPYFILE_DISABLE=1 tar --no-xattrs -czf "$work/bundle.tar.gz" -C "$work" site Caddyfile install.sh s9v10-web.service
web_ssh_args=(-i terminal/.state/lightsail_admin -o HostKeyAlias=s9v10-admin -o UserKnownHostsFile=terminal/.state/known_hosts -o StrictHostKeyChecking=yes -o ConnectTimeout=8)
scp "${web_ssh_args[@]}" -P 22222 "$work/bundle.tar.gz" ec2-user@3.147.94.53:/tmp/s9v10-web.tar.gz
ssh "${web_ssh_args[@]}" -p 22222 ec2-user@3.147.94.53 'bash -se' <<'REMOTE'
set -euo pipefail
work=$(mktemp -d /tmp/s9v10-web-deploy.XXXXXX)
trap 'rm -rf "$work"; rm -f /tmp/s9v10-web.tar.gz' EXIT
tar -xzf /tmp/s9v10-web.tar.gz -C "$work"
sudo bash "$work/install.sh"
REMOTE
