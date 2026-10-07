# HTTPS on the SSH hostname

`https://sh.s9v10.dev/` displays the terminal connection page; `ssh sh.s9v10.dev`
still opens the portfolio. Both use the existing Lightsail instance and static
IP. No second instance or load balancer is needed.

Caddy handles HTTPS certificates and their renewal on ports 80/443. It proxies
only the landing page and its CSS, JavaScript, and two fonts from GitHub Pages.
The root path maps to `https://s9v10.dev/terminal.html`, so normal website commits
update the page without a second content deployment (subject to GitHub's cache).
Keep that source URL serving the page; redirecting it to `sh.s9v10.dev` would
create a redirect loop. Add newly required assets to the Caddyfile allowlist.

## Install on the existing server

Allow public TCP ports 80 and 443 in Lightsail (`s9v10-terminal`, `us-east-2`,
profile `s9v10`). Use `open-instance-public-ports` for each port so the existing
port 22 and restricted administrative port 22222 rules stay intact. Leave DNS
pointed at `3.147.94.53`.

Copy this directory to the server through the existing administrative SSH
connection, then run `sudo bash install.sh` there. The installer verifies the
pinned official Caddy archive before installing it and the `s9v10-web` service.
It does not restart or modify the terminal SSH service.

## Maintenance

- Configuration: `/etc/caddy/Caddyfile`.
- Certificates and Caddy state: `/var/lib/caddy` (private to the `caddy` user).
- Logs: `sudo journalctl -u s9v10-web`.
- Reload configuration: `sudo systemctl reload s9v10-web`.
- Caddy upgrades: update the version and official SHA-512 in `install.sh`, then
  rerun the installer. This static binary is not updated by `dnf`.
- Disable the web endpoint: `sudo systemctl disable --now s9v10-web`, close only
  TCP 80/443 in Lightsail, and restore the main site's link to `/terminal.html`.
  Preserve `/var/lib/caddy` for certificate reuse if re-enabling it.

Check HTTPS, both fonts, the copy button, and `node terminal/scripts/smoke-remote.mjs`
after deployment. The Caddy admin socket is private, the process runs without a
login shell, and its memory is capped at 128 MiB to share the small instance.

References: [Caddy installation](https://caddyserver.com/docs/install),
[automatic HTTPS](https://caddyserver.com/docs/automatic-https), and
[reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy).
