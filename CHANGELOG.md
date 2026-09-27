# Changelog

Releases are git tags served through jsDelivr (`@latest` is the newest tag). Each plugin also has its own `VERSION` constant.

## Unreleased

- Repository layout: `sync/README.md` for the sync server, Neo screenshots in `docs/`, MIT license, GitHub Actions for syntax checks and jsDelivr cache purge on release.

## v3.0.0 — 2026-09-27

All plugins are now released through jsDelivr.

- **Torrents button** (`torrent_button.js`): «Торренты» button on the movie card; search in your own parser, a public JacRed, or both at once («Везде», default) with duplicates removed.
- **Neo** (`neo.js` 1.4.0): redesigned interface with five themes (Netflix, Apple TV, Minimal, Kids, Cinema), a banner with logo, rating, genres and description, banner and poster size settings, sharp original backdrops after a short focus delay. Settings are stored per profile.
- **LG tracks** (`lg_tracks.js` 1.0.0): audio track picker in the player on LG webOS TVs, for torrents where Lampa's built-in button never appears.
- **Profiles** (`profiles.js` 1.7.0) and the **sync server** (`sync/`): per-profile bookmarks, history, timecodes and plugin settings; shared TorrServer, parser and plugin list; manual download/upload; plugin lists merged on first sync.
- The Stremio addon moved to [stremio-hits](https://github.com/mvinkarklins/stremio-hits).
- README and code comments translated to English; plugin UI stays in Russian.

## v2.0.0 — 2026-09-25

- **Kids** (`kids_age.js` 2.0.0): single "under 6" group instead of 0–3 and 4–6, Studio Ghibli collection, fresh and box-office cartoons, box-office movies, top series; movies without a US rating (NR) are hidden.

## v1.0.0 — 2026-09-24

- **Kids** (`kids_age.js`): first release — movies, cartoons and series picked by the child's age from TMDB.
