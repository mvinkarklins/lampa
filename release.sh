#!/bin/sh
# Release all plugins through jsDelivr: tag the current commit, push the tag
# and purge the @latest cache for every plugin file.
#   ./release.sh 3.0.1
set -e

VERSION="$1"
[ -n "$VERSION" ] || { echo "usage: $0 X.Y.Z" >&2; exit 1; }

if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "commit your changes first" >&2
    exit 1
fi

git tag "v$VERSION"
git push origin main "v$VERSION"

for f in *.js; do
    curl -s -o /dev/null -w "purge $f: %{http_code}\n" "https://purge.jsdelivr.net/gh/mvinkarklins/lampa@latest/$f"
done
