# TorBox

`torbox.js` puts a «TorBox» button right next to the «Торренты» button on the movie card.

```
https://cdn.jsdelivr.net/gh/mvinkarklins/lampa@latest/torbox.js
```

On press it searches with your own parser (same search Lampa itself uses, configured in
Settings → Parser), then lets you pick a release and streams it straight from
[TorBox](https://torbox.app) — no local download, no Deluge or TorrServer involved. TorBox
caches the torrent on their side and hands back a direct link; your TV just plays that link.

## Setup

1. A paid [TorBox](https://torbox.app) account and its API key (Settings on torbox.app).
2. The [Profiles](profiles.md) plugin's sync server configured (Settings → Профили → Сервер) —
   TorBox needs it too, see "Why a server" below.
3. Settings → Parser → «TorBox: API-ключ» → paste your key. First use (if you skip this) asks
   for it on the spot.

## Why a server

TorBox's API requires a custom `Authorization` header, and browsers refuse to send that
cross-origin unless the server explicitly allows it — TorBox doesn't. So API calls (adding a
magnet, checking status, asking for the play link) go through your own `lampa-sync` server,
which just relays those few calls to `api.torbox.app` unchanged (see `sync/server.js`,
`/api/torbox/*`). It never reads or stores your API key.

The actual video is **not** relayed through your server: TorBox returns a direct link to its
own CDN, and the player streams from there directly.

## Notes

- Picks the largest video file in the torrent (asks if there's more than one, e.g. multi-episode
  packs).
- If TorBox is still downloading/caching, you'll see a "качаю/кэширую" notice; it polls for up
  to ~3 minutes before giving up (TorBox's own app will keep going — check there if this plugin
  times out).

[← All plugins](../README.md)
