# HTTPS on the SSH hostname

`https://sh.s9v10.dev/` displays the terminal connection page; `ssh sh.s9v10.dev`
still opens the portfolio. Both use the existing Lightsail instance and static
IP. No second instance or load balancer is needed.

Caddy handles HTTPS certificates and their renewal on ports 80/443. It serves
the page and its CSS, JavaScript, and two fonts directly from `/srv/s9v10-web`.
There is no GitHub Pages dependency or duplicate `/terminal.html` page.

The HTML and JavaScript source live in `terminal/web/`. The build copies the
shared `assets/css/terminal.css` and Inter fonts from the main website and adds
an asset content hash to the HTML for cache invalidation. Add newly required
assets to the build, installer, and Caddyfile allowlist.

## Publish page changes

From the repository root, run:

```sh
bash terminal/deploy/web/update.sh
```

This builds and uploads only the landing page, then installs the static files
and Caddy configuration on the existing server. It does not rebuild, restart,
or publish changes to the SSH portfolio. GitHub Pages deployments do not update
this endpoint; use this command when changing the landing page or its assets.

## Install on the existing server

Allow public TCP ports 80 and 443 in Lightsail (`s9v10-terminal`, `us-east-2`,
profile `s9v10`). Use `open-instance-public-ports` for each port so the existing
port 22 and restricted administrative port 22222 rules stay intact. Leave DNS
pointed at `3.147.94.53`.

The publish command above also handles the initial installation. The installer
verifies the pinned official Caddy archive before installing it and the
`s9v10-web` service.

## Maintenance

- Configuration: `/etc/caddy/Caddyfile`.
- Static document root: `/srv/s9v10-web` (root-owned and read-only to Caddy).
- Certificates and Caddy state: `/var/lib/caddy` (private to the `caddy` user).
- Logs: `sudo journalctl -u s9v10-web`.
- Reload configuration: `sudo systemctl reload s9v10-web`.
- Caddy upgrades: update the version and official SHA-512 in `install.sh`, then
  run the publish command. This static binary is not updated by `dnf`.
- Disable the web endpoint: `sudo systemctl disable --now s9v10-web`, close only
  TCP 80/443 in Lightsail, and remove the main site's terminal link.
  Preserve `/var/lib/caddy` for certificate reuse if re-enabling it.

Check HTTPS, both fonts, the copy button, and `node terminal/scripts/smoke-remote.mjs`
after deployment. The Caddy admin socket is private, the process runs without a
login shell, and its memory is capped at 128 MiB to share the small instance.

References: [Caddy installation](https://caddyserver.com/docs/install),
[automatic HTTPS](https://caddyserver.com/docs/automatic-https), and
[static file serving](https://caddyserver.com/docs/caddyfile/directives/file_server).
