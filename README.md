# Lampa plugins

Plugins for [Lampa](https://github.com/yumata/lampa), a media center app for TVs, Android and browsers. To install one, open Lampa → Settings → Extensions → Add plugin, and paste its link.

The plugins' own interface is in Russian, like Lampa itself; Russian names of buttons and menu items are quoted below as they appear on screen.

| Plugin | What it does | Link |
|---|---|---|
| Kids («Детям») | movies and cartoons picked by the child's age | `https://cdn.jsdelivr.net/gh/mvinkarklins/lampa@latest/kids_age.js` |
| Torrents button | a «Торренты» button on the movie card; searches your own parser and public JacRed | `https://mvinkarklins.github.io/lampa/torrent_button.js` |
| Neo interface | a redesigned Lampa with five themes | `https://mvinkarklins.github.io/lampa/neo.js` |
| LG tracks | audio track picker in the player on LG TVs | `https://mvinkarklins.github.io/lampa/lg_tracks.js` |
| Profiles | profiles and sync through your own server (`sync/`) | `https://mvinkarklins.github.io/lampa/profiles.js` |

All plugins are plain ES5 JavaScript with no build step, so they run on old TV browsers.

## Kids by age («Детям»)

Picks movies, cartoons and animated series suitable for the child's age, using TMDB data.

### Install

Settings → Extensions → Add plugin, then paste:

```
https://cdn.jsdelivr.net/gh/mvinkarklins/lampa@latest/kids_age.js
```

After a restart, a **«Детям»** item appears in the left menu. The plugin version is shown in the title of the age picker.

### How it works

1. Pick an age: under 6, 7–9, 10–12 or 13–15 (the last choice is remembered).
2. Pick a collection:
   - cartoons: popular, top rated, new, latest (by release date), box office;
   - Studio Ghibli: Hayao Miyazaki and Ghibli films suitable for the age;
   - animated series: popular, top rated, hits (most votes in recent years);
   - movies: popular, top rated, new, box office;
   - TV series: popular, hits.

For children under 6, box office and hits look back ten years; for older children, three years.

Filtering:

| Age | Movies (MPAA rating) | TV series (TV Parental Guidelines) | Extra |
|---|---|---|---|
| under 6 | G | TV-Y, TV-Y7, TV-G | only animated series in the Kids genre |
| 7–9 | G, PG | TV-Y, TV-Y7, TV-G | |
| 10–12 | G, PG | + TV-PG | any animated series |
| 13–15 | G, PG, PG-13 | + TV-PG | + adventure and sci-fi series |

Movies and series without a US rating (NR) are not shown. Horror, thriller, crime and war are always excluded (for series also news, reality, soap and talk shows).

### Development and releases

There are two links to the plugin:

| | Link | Serves | Updates |
|---|---|---|---|
| **prod** | `https://cdn.jsdelivr.net/gh/mvinkarklins/lampa@latest/kids_age.js` | the latest release (tag `vX.Y.Z`) | after a release, up to 12 hours |
| **dev** | `https://mvinkarklins.github.io/lampa/kids_age.js` | the current `main` branch (GitHub Pages) | 1–2 minutes after a push |

To test changes, install the dev link in Lampa. When everything works, release a version:

1. Bump `VERSION` in `kids_age.js` and commit.
2. Tag and push the tag: `git tag v2.0.1 && git push origin v2.0.1`.
3. Purge the jsDelivr cache: open `https://purge.jsdelivr.net/gh/mvinkarklins/lampa@latest/kids_age.js`.

The other plugins are served from GitHub Pages only and update 1–2 minutes after a push to `main`.

## Torrents button

`torrent_button.js` puts a «Торренты» button right on the movie card, next to «Смотреть» (Watch). Lampa can pin it natively with a long press in the source picker, but long press does not work on LG remotes.

```
https://mvinkarklins.github.io/lampa/torrent_button.js
```

On press, the search runs in one of these sources:

- **your own parser** from Lampa settings (for example Prowlarr);
- **a public JacRed** (jac.red, jac-red.ru, jr.maxvol.pro), as a fallback when yours is down;
- **everywhere** («Везде», the default): your parser and jac.red in parallel, results merged, duplicates removed (same title and size).

To change the default, for example to ask every time: Settings → Parser → «Кнопка «Торренты» на карточке». The public parser is substituted for a single search only and never written to settings.

Trackers behind Cloudflare, such as RuTracker and Kinozal, usually cannot be searched by Prowlarr without FlareSolverr; the «Везде» mode still finds them through jac.red.

## Neo interface

`neo.js` restyles Lampa: rounded posters with a clear focus and colored ratings; on the home screen and in collections, a banner above the rows shows the backdrop, logo and description of the focused movie; the movie card shows the logo instead of the title and pill-shaped buttons.

```
https://mvinkarklins.github.io/lampa/neo.js
```

Enable it in Settings → Interface → «Интерфейс Neo». The same section has:

**Theme** («Тема Neo»):

| Theme | Look |
|---|---|
| Netflix | dark, red accent, description on the left |
| Apple TV | soft corners, large glowing focus, description centered |
| Minimal | flat, blue accent, text title, compact banner |
| Kids | purple-pink gradient, big corners, yellow focus, colored logos |
| Cinema | black and gold, spaced uppercase row titles, sharp buttons |

**Banner** («Баннер Neo»): compact (default, about a third of the screen: logo, rating, year, genres, two lines of description), large, or off.

**Posters** («Постеры Neo»): smaller (default, 7–8 posters per row instead of 6), tiny, or normal.

The banner backdrop loads at 1280 px first; if focus stays on a movie for over a second, it is replaced with the TMDB original (usually 1920×1080, sometimes 4K). TMDB has no 1920 size.

Movie logos are shown as a white silhouette (except in the Kids theme): some TMDB logos are dark, and CORS prevents reading image colors in the browser.

The on/off flag, theme, banner and poster sizes are stored in the profile, so Neo can be enabled for one profile only. With the flag off, the plugin changes nothing.

## LG tracks

`lg_tracks.js` adds a «Дорожки LG» (LG tracks) button to the Lampa player panel on LG TVs.

```
https://mvinkarklins.github.io/lampa/lg_tracks.js
```

Lampa gets the audio track list from the webOS media service, but only looks for the video during the first second after playback starts. Torrents start slower, the list never arrives, and the built-in tracks button stays hidden. The new button requests the list on press, while the movie is already playing (waiting up to 20 seconds), shows a picker and switches the track without restarting the video. It also hands the list to Lampa, so the built-in button appears too. On other devices the plugin does nothing.

## Profiles with sync

`profiles.js` adds a left-menu item with the current profile name. Each profile has its own bookmarks, history, timecodes, age in «Детям», Torrents button choice and Neo settings. TorrServer and parser settings and the list of installed plugins are shared by all profiles and devices; after the plugin list changes, Lampa restarts itself.

```
https://mvinkarklins.github.io/lampa/profiles.js
```

### Server

Data is kept by a small server in `sync/`: Node.js with no dependencies, storing JSON files on disk. It has **no authentication**, so run it only inside your home network (or behind a VPN such as Tailscale).

Build and run in microk8s:

```
cd sync
docker build -t lampa-sync:1.0.1 .
docker save lampa-sync:1.0.1 | microk8s ctr image import -
microk8s kubectl apply -f k8s.yaml
```

`k8s.yaml` exposes the server through a MetalLB `LoadBalancer` at `192.168.1.25` and stores data in a hostPath volume; change both for your network. The plugin uses `http://192.168.1.25` by default; another address can be set in the profile menu → «Сервер».

Or with plain Docker:

```
docker run -d -p 8080:8080 -v lampa-sync:/data lampa-sync:1.0.1
```

API:

| Method | Path | Purpose |
|---|---|---|
| `GET` / `PUT` | `/api/profiles` | list of profiles `{profiles: [{id, name}]}` |
| `GET` | `/api/store/<shared\|id>` | stored values `{key: {v, t}}` |
| `POST` | `/api/store/<shared\|id>` | merge values; for each key the later `t` wins |
| `DELETE` | `/api/store/<id>` | delete a profile's data |
| `GET` | `/health` | health check |

### How it works

- The first device creates a «Основной» (Main) profile from its own data.
- A new device asks to pick a profile on startup; on conflict the server's data wins, the rest is merged in.
- When switching profiles, the current data is pushed to the server, then the new profile's data is loaded and Lampa restarts.
- The profile menu has «Синхронизировать сейчас» (sync now), plus «Загрузить с сервера» (download) and «Отправить на сервер» (upload), which fully replace one side with the other after a confirmation.
- Sync runs on startup, 5 seconds after changes, every 5 minutes and when the app goes to the background; on conflict the later change wins.
- With a CUB account signed in, Lampa takes bookmarks from the CUB cloud and they override the profiles, so sign out of CUB to use profiles.

## Stremio

The Stremio addon (box office hits, new releases, top series) has moved to its own repository, [stremio-hits](https://github.com/mvinkarklins/stremio-hits).
