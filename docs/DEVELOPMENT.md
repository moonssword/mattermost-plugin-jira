<!-- Copied from the upstream README and kept close to it, so upstream changes merge easily. -->

# Local development

Follow these steps to spin up Mattermost and Jira locally so you can iterate on the plugin with real APIs.

## Prerequisites

- Go, the version in `go.mod`
- Node, the version in `.nvmrc`, and npm
- Docker Desktop (for Jira Server + optional Postgres)
- The [mattermost](https://github.com/mattermost/mattermost) repo cloned locally alongside this one

## 1. Run Mattermost with the enterprise repo beside it

Clone both repos into the same parent directory so the enterprise code is detected automatically, then start the server:

```bash
git clone https://github.com/mattermost/mattermost.git
git clone https://github.com/mattermost/enterprise.git

cd mattermost/server
make run
```

If `./bin/mmctl` is not present yet, build it once so you can tweak config from the command line:

```bash
go build -o bin/mmctl ./cmd/mmctl
```

Configure the server so Jira can reach it and so plugins can be uploaded. Either edit `config/config.json` directly or run the following commands. Note that localhost URLs won't be recognized by the plugin:

```bash
./bin/mmctl --local config set ServiceSettings.SiteURL http://host.docker.internal:8065
./bin/mmctl --local config set PluginSettings.Enable true
./bin/mmctl --local config set PluginSettings.EnableUploads true
./bin/mmctl --local config set ServiceSettings.AllowCorsFrom http://host.docker.internal:8065
./bin/mmctl --local config set ServiceSettings.AllowedUntrustedInternalConnections "localhost,127.0.0.1,::1,host.docker.internal"
```

Restart the server if prompted.

**Reachability tips**

- `host.docker.internal` works on macOS with Docker Desktop. On Linux, specify the gateway explicitly when starting Jira (`docker run --add-host=host.docker.internal:host-gateway ...`) or use your workstation’s LAN IP in both `SiteURL` and the commands above.
- Whichever hostname you choose, open Mattermost in your browser using that same URL as mismatches can trigger WebSocket CORS blocks and slash-command errors.
- If Jira runs on another machine or you need external access, expose Mattermost via a tunnel or a real domain with valid HTTPS, and update the config values accordingly.
- When you create the Application Link in Jira, supply that same externally reachable Mattermost URL. Jira reuses it to call the plugin’s endpoints.
- You can sanity-check connectivity from the Jira container with `docker exec jira curl -I <your-site-url>`.

## 2. Build and install the Jira plugin

```bash
cd ../mattermost-plugin-jira
npm install
make dist

# optionally let the Makefile upload straight to your dev server
export MM_SERVICESETTINGS_SITEURL=http://host.docker.internal:8065
export MM_ADMIN_USERNAME=admin
export MM_ADMIN_PASSWORD=admin
make deploy
```

If you prefer to upload manually, go to **System Console → Plugins → Upload Plugin**, select `dist/jira-*.tar.gz`, then enable the plugin under **Plugin Management**.

For a tighter edit loop, leave `make watch` running – it rebuilds and redeploys whenever you save.

## 3. Launch a local Jira Server in Docker

```bash
docker pull atlassian/jira-software:9.4.30
docker run --name jira \
  -d -p 8080:8080 \
  atlassian/jira-software:9.4.30
```

Open `http://localhost:8080`, request a **Server** evaluation license from [my.atlassian.com](https://my.atlassian.com/), and finish the setup wizard. Wherever the wizard asks for your Mattermost URL, use `http://host.docker.internal:8065` so the container can call back into your dev server.

## 4. Connect the plugin to Jira

Back in Mattermost, confirm the plugin responds to `/jira help`, then install your local instance:

```bash
/jira instance install server http://localhost:8080
```

The command guides you through creating the Application Link inside Jira, exchanging the consumer key/secret, and configuring webhooks. Once that completes, run `/jira connect` to link your Mattermost user, and use `/jira create` or `/jira subscribe` to test the round trip.

At this point you can edit plugin code, let `make watch` redeploy, and immediately exercise the change against a real Jira API.

## Troubleshooting the local setup

- **Plugin immediately disables itself when enabled** – check `logs/mattermost.log`. If you see `please configure the Mattermost server's SiteURL`, set `ServiceSettings.SiteURL` to a reachable address (e.g. `http://host.docker.internal:8065`) and re-enable the plugin.
- **Upload button missing in System Console** – ensure `PluginSettings.EnableUploads` is `true` in `config/config.json`. You may need to restart the server after changing it.
- **`./bin/mmctl` not found** – build it with `go build -o bin/mmctl ./cmd/mmctl` from the `mattermost/server` directory.
- **Jira setup page refuses license** – generate a **Server** evaluation key for the Server ID shown in the wizard via [my.atlassian.com](https://my.atlassian.com/). Make sure you select the Server deployment type, not Cloud.
- **`XSRF Security Token Missing` during Jira setup** – refresh the page or restart the Docker container and re-run the wizard in a fresh browser session; the token expired.
- **Slash commands complain about unreachable Mattermost URL** – Jira is running in a container, so `localhost` refers to the container itself. Use `http://host.docker.internal:8065` (macOS/Linux with Docker Desktop) or your machine’s LAN IP so Jira can reach Mattermost.

## Checks

Run them before every commit, one after the other:

```bash
make check-style   # golangci-lint and eslint
make test          # Go tests and Jest
```

## Bundle for production

Build from a commit with a release tag, without the development variables:

```bash
unset MM_DEBUG MM_SERVICESETTINGS_ENABLEDEVELOPER
make dist
```

On macOS, pack the bundle again without extended attributes, or Mattermost may reject the `._*` files that `tar` adds:

```bash
cd dist && COPYFILE_DISABLE=1 tar --no-xattrs --no-mac-metadata -czf jira-<version>.tar.gz jira
```

## Keeping up with upstream

`master` mirrors [mattermost/mattermost-plugin-jira](https://github.com/mattermost/mattermost-plugin-jira); `main` carries this fork. Merge upstream release tags of the line that supports the Mattermost version in use (4.8.x for Mattermost 10.7–11.x, 5.x needs Mattermost 12):

```bash
git remote add upstream https://github.com/mattermost/mattermost-plugin-jira.git
git fetch upstream --tags
git merge --no-ff v4.8.4
```

Conflicts most often come from files both sides change: `server/plugin.go`, `server/webhook.go`, `server/issue.go` and their tests.
