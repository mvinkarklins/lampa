# Profiles

`profiles.js` adds a left-menu item with the current profile name. Each profile has its own bookmarks, history, timecodes, age in «Детям», Torrents button choice and Neo settings. TorrServer and parser settings and the list of installed plugins are shared by all profiles and devices; after the plugin list changes, Lampa restarts itself.

```
https://cdn.jsdelivr.net/gh/mvinkarklins/lampa@latest/profiles.js
```

Data is kept by a small self-hosted server; see [sync/README.md](../sync/README.md) for running it and its API. The server has no authentication, so keep it inside your home network.

- The first device creates a «Основной» (Main) profile from its own data.
- A new device asks to pick a profile on startup; on conflict the server's data wins, the rest is merged in.
- When switching profiles, the current data is pushed, the new profile's data is loaded and Lampa restarts.
- The profile menu has «Синхронизировать сейчас» (sync now), plus «Загрузить с сервера» (download) and «Отправить на сервер» (upload), which fully replace one side with the other after a confirmation.
- Sync runs on startup, 5 seconds after changes, every 5 minutes and when the app goes to the background; on conflict the later change wins.
- With a CUB account signed in, Lampa takes bookmarks from the CUB cloud and they override the profiles, so sign out of CUB to use profiles.

[← All plugins](../README.md)
