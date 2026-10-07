#!/bin/bash
# Run as root on the existing Amazon Linux x86_64 Lightsail instance.
set -euo pipefail
cd "$(dirname "$0")"
[[ $EUID -eq 0 ]] || { echo 'Run this installer with sudo.' >&2; exit 1; }
[[ $(uname -m) == x86_64 ]] || { echo 'This download is for x86_64.' >&2; exit 1; }

assets=(assets/css/terminal.css assets/js/terminal.js assets/fonts/Inter_28pt-Regular.woff2 assets/fonts/Inter-SemiBold.woff2)
for file in index.html "${assets[@]}"; do
  [[ -s "site/$file" ]] || { echo "Missing built page file: $file" >&2; exit 1; }
done

version=2.11.7
archive="caddy_${version}_linux_amd64.tar.gz"
# SHA-512 from the official release's checksums.txt.
checksum=a7a433a1b133efc3c8d10eb0b99d52a24b5ef5c322dc77f5282182b1c0402139ab83f3a99f0c52409df77d20123fb0b523edad8a66d8f5e49136197bf61ef0e7
work=$(mktemp -d /tmp/s9v10-web-install.XXXXXX)
trap 'rm -rf "$work"' EXIT
curl --fail --silent --show-error --location --retry 3 \
  "https://github.com/caddyserver/caddy/releases/download/v${version}/${archive}" \
  --output "$work/$archive"
(cd "$work" && printf '%s  %s\n' "$checksum" "$archive" | sha512sum --check -)
tar -xzf "$work/$archive" -C "$work" caddy
"$work/caddy" validate --config "$PWD/Caddyfile" --adapter caddyfile

getent group caddy >/dev/null || groupadd --system caddy
id caddy >/dev/null 2>&1 || useradd --system --gid caddy --home-dir /var/lib/caddy --shell /sbin/nologin caddy
install -d -o caddy -g caddy -m 0700 /var/lib/caddy
install -d -o root -g caddy -m 0750 /etc/caddy
# The public document root contains only these five static files.
install -d -o root -g root -m 0755 /srv/s9v10-web /srv/s9v10-web/assets/{css,js,fonts}
for file in "${assets[@]}"; do
  install -o root -g root -m 0644 "site/$file" "/srv/s9v10-web/$file"
done
# Publish the document last, after its versioned assets are in place.
install -o root -g root -m 0644 site/index.html /srv/s9v10-web/index.html.new
mv /srv/s9v10-web/index.html.new /srv/s9v10-web/index.html
install -o root -g root -m 0755 "$work/caddy" /usr/local/bin/caddy.new
mv /usr/local/bin/caddy.new /usr/local/bin/caddy
install -o root -g caddy -m 0640 Caddyfile /etc/caddy/Caddyfile
install -o root -g root -m 0644 s9v10-web.service /etc/systemd/system/s9v10-web.service
systemctl daemon-reload
systemctl enable s9v10-web
systemctl restart s9v10-web
systemctl is-active s9v10-web
