# s9v10.dev, over SSH

A terminal counterpart to the Jekyll site: one animated ASCII wave across the background, colored ASCII artwork, lists on the left with live entry previews on the right, and a command prompt. No account or password is needed to visit.

## Try it locally

Requires Node.js 22 or newer to run. Rebuilding content also needs Python 3 with Pillow (`python3 -m pip install -r terminal/scripts/requirements.txt`). From the repository root:

```sh
cd terminal
npm ci --omit=optional --ignore-scripts
npm run build
npm start
```

In a second terminal:

```sh
ssh -p 2222 localhost
```

Accept the normal SSH host identity prompt on your first connection. The app generates an Ed25519 host key in `terminal/.state/`; that directory is ignored by Git. Keep that key between restarts so returning visitors recognize the server.

Interactive connections open on a completely black screen with “Do you see how infinite you are?” centered in the current window. It holds for 1.5 seconds, fades out over 0.6 seconds, then reveals Home. Resizing keeps the quote centered. A keystroke skips the opening and is handled normally; noninteractive SSH commands return immediately.

`npm run preview` opens the same interface directly in your terminal, without SSH. `ssh -p 2222 localhost projects` returns a readable project preview without entering the interactive app.

## Navigation

| Input | Action |
| --- | --- |
| `about`, `projects`, `art`, `blog`, `contact` | Change section |
| `0` through `5`, with an empty prompt | Jump immediately to home / about / projects / art / blog / contact |
| `6` through `9`, with an empty prompt | GitHub / LinkedIn / Twitter / TikTok links |
| Up / Down | Switch the preview; scroll text after Enter |
| Enter | Focus a project or blog post / read an entry, or execute the command |
| `read 2` / `pixie` | Read by list number or slug |
| `search AI` / `search` | Filter a collection / clear the filter |
| `links` / `references` | Source, demo, and reference links with matching letter labels |
| `color` / `color on` / `color off` | Toggle the website's six-color palette |
| `motion` / `motion off` | Toggle / pause the ASCII animation |
| Tab | Complete a command or slug |
| Ctrl-P / Ctrl-N | Command history; Up/Down also work while editing |
| Ctrl-B / Ctrl-F / Home / End | Move within the command |
| Ctrl-U | Clear the prompt |
| Left / Esc | Back |
| Right | Forward |
| `forward` | Go forward through page history |
| `back` | Go back through page history |
| Page Up / Page Down | Scroll the right preview without changing the selection |
| `help` / `?` | Built-in guide |
| `quit` / Ctrl-C / Ctrl-D | Disconnect |

`links` shows the current entry's website, source, demo, and other references. Up/Down selects a reference and displays its clickable URL directly. Esc / Left returns to the entry. Repeating `links` or pressing Enter on a reference stays in the same view.

Links use OSC 8 hyperlinks. Cmd-click or Ctrl-click opens them in supporting terminal emulators; the URL is also displayed for copying. A remote SSH application cannot force a browser to open on the visitor's computer. It never launches a browser on the server or changes the visitor's clipboard.

Every link has a letter label: `[a]`, `[b]`, ... `[z]`, `[aa]`, etc. Labels are stable within each entry, repeated URLs share a label, and the `links` view uses the same labels as the text. Letters identify the same links throughout the entry and references list.

The layout fills the terminal, including windows wider than 120 columns or taller than 60 rows, and adapts down to 16 columns by 8 rows. Smaller windows show a resize hint; pathological SSH dimensions are bounded at 1024 columns and 256 rows. The background uses one main Bezier wave and no thin waves, with the desktop website's motion settings: 200-line trails, 45-degree rotation, amplitude 1.5, the same speed ranges, stroke opacity, glyph mapping, and sparse color placement. The terminal sends 8 frames per second while advancing the motion at the site's 30 updates per second. Pausing freezes that clock. The native rasterizer accounts for tall terminal cells and reduces sampling resolution for huge windows; stroke edges and 256-color shades therefore differ slightly from browser canvas output. Only changed rows are sent. The background is monochrome by default; `color` toggles its palette. Artwork always uses colors sampled from the source images. Each visitor has separate navigation, back/forward history, and animation preferences.

Projects, art, blog, contact, and references use the same list/preview arrangement. Up/Down changes the selected entry immediately; Page Up/Down scrolls the preview independently. In Projects and Blog, Enter or Right focuses the preview and Up/Down scrolls its text. A thin ASCII border occupies the existing gutters without reflowing the content. Esc or Left unfocuses it while preserving the selection, filter, and scroll position; a second press goes back. Focusing does not add a page to history. The contextual footer shows the focus keys only in Projects and Blog. Art entries open for reading with Enter. Section navigation stays at the top on every page. Home, About, and Help use the full width; the left column is reserved for entry lists. Narrow windows give the preview the full width; the command prompt and number shortcuts still navigate. Images fit the available columns and rows with terminal cell proportions taken into account, and use standard 256-color text. `links` includes the selected entry's website page.

## Content updates

From `terminal/`, run `npm run build` after changing the Jekyll content. It reads `_config.yml`, `_pages/about.md`, `_projects`, `_art`, `_posts`, and the main layout's social links and writes `content/site.json`. Projects/art retain their website ordering; blog posts use their canonical dates and slugs. Links are labeled before Markdown/HTML is converted to text, retaining the correspondence to references. Pillow converts artwork into compressed RGB samples at build time; Node renders colored ASCII at each visitor's terminal size without an image library on the server. The terminal About page ends at “always looking for new opportunities!” The generated snapshot is committed and deployed with the app; no runtime access to GitHub is needed.

## Deploy

GitHub Pages continues to serve the website. SSH needs a server with a public TCP port. The intended visitor address is **`ssh sh.s9v10.dev`**.

### Current AWS server

Deployed in `us-east-2` on Lightsail `s9v10-terminal`, the **$5/month** Linux bundle (`nano_3_0`): 512 MB RAM, 20 GB disk, and 1 TB transfer. The attached static IPv4 address is `3.147.94.53`; Name.com uses an A record named `sh`, TTL 300. No snapshots, load balancer, or separate EC2 instance were added. See [AWS pricing](https://aws.amazon.com/lightsail/pricing/); transfer above the allowance costs extra.

The AWS free plan was active with $100 remaining when deployed on October 6, 2026. Its recorded end date is April 6, 2027. Six months of this server costs about $30 before any offers/taxes or excess transfer; a $100 balance does not extend the free plan's duration. Check the current credit balance and plan in AWS Settings → Billing. No paid-plan upgrade was made.

The app runs directly under systemd with Node 22, an unprivileged service user, a read-only system view, and a 160 MB memory cap. Its persistent host key is `/var/lib/s9v10-terminal/host_ed25519`. Public SSH port 22 only serves the portfolio. Administrative SSH is on port 22222 and restricted by the Lightsail firewall to the administrator's current public IPv4 address.

Administrative access from this repository:

```sh
ssh -i terminal/.state/lightsail_admin -p 22222 \
  -o HostKeyAlias=s9v10-admin \
  -o UserKnownHostsFile=terminal/.state/known_hosts \
  ec2-user@3.147.94.53
```

Keep the private administrative key in a secure backup; `.state/` is Git-ignored and excluded from the Jekyll website and deployment archive. If your public IP changes, update only the port 22222 firewall rule in Lightsail before connecting. Do not open administrative SSH to everyone.

After editing content or code, run from the repository root:

```sh
bash terminal/deploy/update.sh
node terminal/scripts/smoke-remote.mjs
```

The update rebuilds the content snapshot, uploads only app files, reinstalls locked dependencies, and restarts the service. It preserves the portfolio host key. The live smoke check pins the expected host identity recorded in `deploy/state.json` and verifies navigation, links, resizing, and rejected file/forwarding/shell requests. Inspect service logs with `sudo journalctl -u s9v10-terminal --since '10 minutes ago'` over the administrative connection.

To remove this hosting later, delete the Lightsail instance, release its static IP, and remove the `sh` DNS record. Stopping a Lightsail instance alone does not end its billing. Preserve the host key first if migrating to another server.

### Optional Docker deployment

On a server with Docker and the Compose plugin, copy this directory, then:

```sh
docker compose up -d --build
docker compose logs --tail 30
```

This initially exposes port **2222** so it can coexist with the server's administrative SSH on port 22. Test with `ssh -p 2222 SERVER_IP`.

For the final port-free command:

1. Make administrative access available separately (for example, AWS Systems Manager or an SSH listener on port 22222 restricted to your IP). Verify that access before freeing port 22.
2. Put `SSH_PUBLIC_PORT=22` in a `terminal/.env` file on the server, then run `docker compose up -d`.
3. Allow inbound TCP 22 to the portfolio in the server's firewall/security group.
4. Add a DNS **A** record named **`sh`** pointing to the server's stable public IPv4 address. Leave the apex and `www` records for GitHub Pages unchanged. If using Cloudflare, this record must be **DNS only**, not HTTP-proxied.
5. Connect with `ssh sh.s9v10.dev` and test navigation, `links`, and `quit` from a second computer/network.

Do not publish an AAAA record unless this server is also configured and reachable over IPv6. Preserve the Compose `host-key` volume during updates. `docker compose down` preserves it; `docker compose down -v` deletes it and changes the identity seen by returning visitors.

The container runs as an unprivileged user with a read-only root filesystem. Only the host-key volume is writable. The SSH service exposes portfolio commands only; it rejects SFTP, file transfer, port forwarding, agent forwarding, X11, and arbitrary shell commands. It caps concurrent connections, input size, idle time (10 minutes), and total session time (one hour).

For a direct Node deployment, set `HOST=0.0.0.0`, `PORT`, and `HOST_KEY_PATH` and run `node src/server.mjs` under a process supervisor. Local defaults bind only to `127.0.0.1:2222`.

## Verify

```sh
npm run build
npm run check
npm test
```

Tests include real local SSH connections, independent visitors, navigation, resize events, terminal hyperlinks, persistent host keys, idle disconnects, and rejected shell/forwarding/file-access requests. The SSH integration tests need permission to bind loopback sockets.
