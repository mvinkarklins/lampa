# lampa-sync

A tiny sync server for the [profiles](../docs/profiles.md) plugin. Node.js with no dependencies; data is stored as JSON files on disk.

It has **no authentication**. Run it only inside your home network or behind a VPN such as Tailscale: anyone who can reach it can read and change every profile, including the parser API key shared through it.

## Run

A ready image is published to GitHub Container Registry for amd64 and arm64:

| Tag | Built from |
|---|---|
| `ghcr.io/mvinkarklins/lampa-sync:latest` | the latest release tag |
| `ghcr.io/mvinkarklins/lampa-sync:X.Y.Z` | release `vX.Y.Z` |
| `ghcr.io/mvinkarklins/lampa-sync:X.Y`, `:X` | the latest release of that minor / major version |
| `ghcr.io/mvinkarklins/lampa-sync:edge` | the `main` branch |
| `ghcr.io/mvinkarklins/lampa-sync:sha-<commit>` | a specific commit |

It is published by CI only after the plugins pass the smoke test against this very image.

```
docker run -d -p 8080:8080 -v lampa-sync:/data ghcr.io/mvinkarklins/lampa-sync:latest
```

Or build it yourself:

```
docker build -t lampa-sync .
docker run -d -p 8080:8080 -v lampa-sync:/data lampa-sync
```

In Kubernetes (microk8s here), with the published image:

```
microk8s kubectl apply -f k8s.yaml
```

`k8s.yaml` uses `:latest` with `imagePullPolicy: Always`, so after a release `microk8s kubectl -n media rollout restart deploy/lampa-sync` picks up the new version.

`k8s.yaml` exposes the server through a MetalLB `LoadBalancer` at `192.168.1.25` and keeps data in a hostPath volume. Change both for your network. The plugin uses `http://192.168.1.25` by default; another address can be set in Lampa: profile menu → «Сервер».

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8080` | listen port |
| `DATA_DIR` | `/data` | where JSON files are stored |

## Storage

| File | Content |
|---|---|
| `profiles.json` | list of profiles |
| `shared.json` | settings shared by all profiles: TorrServer, parser, installed plugins |
| `p_<id>.json` | one profile: bookmarks, history, timecodes, plugin settings |

Every value is stored as `{v, t}`: `v` is the raw `localStorage` string, `t` the change time in milliseconds. When merging, the later `t` wins. Files are written through a temporary file, so a crash never leaves truncated JSON.

## API

All responses are JSON with CORS headers, including `Access-Control-Allow-Private-Network` for browsers that guard requests to local addresses.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/profiles` | `{profiles: [{id, name, kids}]}` |
| `PUT` | `/api/profiles` | replace the list; ids must match `[a-z0-9_-]{1,32}` |
| `GET` | `/api/store/<shared\|id>` | stored values `{key: {v, t}}` |
| `POST` | `/api/store/<shared\|id>` | merge `{key: {v, t}}`, returns the merged store |
| `DELETE` | `/api/store/<id>` | delete a profile's data (`shared` cannot be deleted) |
| `GET` | `/health` | `{ok: true, version}`: the image version (release, `edge`, or `dev` for a local run) |

Requests are logged with the client IP and user agent, which helps to see which device syncs which profile. Request bodies are limited to 20 MB.
