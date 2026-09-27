# Changelog

Releases are git tags served through jsDelivr (`@latest` is the newest tag). Each plugin also has its own `VERSION` constant.

## Unreleased

- CI scans all tracked files for secrets with detect-secrets; the image is published only if the scan passes. False positives are marked with a `pragma: allowlist secret` comment on their line.
- CI split into a 16-job pipeline: linters for plugins (syntax, ES5 via es-check), workflows (actionlint), shell scripts (shellcheck), the Dockerfile (hadolint) and documentation links (lychee); gitleaks over the full git history; Lampa and the image are built once and shared between jobs; smoke tests run against both the pinned and the latest Lampa; the image is checked on amd64 and arm64, scanned with Trivy and gets a CycloneDX SBOM; published images carry SBOM and provenance attestations; a report job summarizes the run.
- Sync server image: npm, yarn and corepack removed (unused at runtime and the source of most known CVEs) and Alpine security updates applied; Trivy finds no fixable HIGH or CRITICAL issues. The health check uses JSON form.
- `release.sh`: clearer check for uncommitted changes (shellcheck SC2015).
- CI actions updated to versions running on Node.js 24 (Node 20 is deprecated on GitHub runners); jobs pinned to `ubuntu-24.04` instead of `ubuntu-latest`, which moves to Ubuntu 26 on 2026-10-19; Dependabot proposes weekly updates of actions and the Node base image.

## v3.0.1 — 2026-09-27

- Repository layout: short README with a plugin index, per-plugin docs and Neo screenshots in `docs/`, `sync/README.md` for the sync server, MIT license, GitHub Actions for syntax checks and jsDelivr cache purge on release.
- Tests: CI builds Lampa from source (pinned commit; the weekly run uses the latest `main`), loads all plugins into it in headless Chromium with the sync server running from its Docker image, and checks each plugin works; a unit test covers LG tracks with a mocked webOS.
- `sync/k8s.yaml` runs the published image `ghcr.io/mvinkarklins/lampa-sync:latest` instead of a locally built one.
- The sync server image is published to `ghcr.io/mvinkarklins/lampa-sync` (amd64 and arm64) after the tests pass: `edge` from `main`, `X.Y.Z` and `latest` from release tags.

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
