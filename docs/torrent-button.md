# Torrents button

`torrent_button.js` puts a «Торренты» button right on the movie card, next to «Смотреть» (Watch). Lampa can pin it natively with a long press in the source picker, but long press does not work on LG remotes.

```
https://cdn.jsdelivr.net/gh/mvinkarklins/lampa@latest/torrent_button.js
```

On press, the search runs in one of these sources:

- **your own parser** from Lampa settings (for example Prowlarr);
- **a public JacRed** (jac.red, jac-red.ru, jr.maxvol.pro), as a fallback when yours is down;
- **everywhere** («Везде», the default): your parser and jac.red in parallel, results merged, duplicates removed (same title and size).

To change the default, for example to ask every time: Settings → Parser → «Кнопка «Торренты» на карточке». The public parser is substituted for a single search only and never written to settings.

Trackers behind Cloudflare, such as RuTracker and Kinozal, usually cannot be searched by Prowlarr without FlareSolverr; the «Везде» mode still finds them through jac.red.

[← All plugins](../README.md)
