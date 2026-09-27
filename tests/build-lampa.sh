#!/bin/sh
# Build Lampa from source (yumata/lampa-source) for the smoke test.
#   tests/build-lampa.sh <git ref> <dir>
# The web app ends up in <dir>/build/github/lampa, the same build as yumata.github.io/lampa.
set -e

REF="${1:-main}"
DIR="${2:-.lampa}"

[ -d "$DIR/.git" ] || git clone -q https://github.com/yumata/lampa-source.git "$DIR"
cd "$DIR"
git fetch -q origin "$REF"
git checkout -q -f FETCH_HEAD

# Lampa's gulpfile only exports packaging tasks that expect an already assembled bundle;
# chain the assembly with the GitHub Pages packaging, the way its dev watcher does.
printf '\nexports.ci_build = series(merge, plugins, sass_task, lang_task, sync_github, uglify_task, public_github, write_manifest, index_github);\n' >> gulpfile.js

npm install --no-audit --no-fund --loglevel=error
npx gulp ci_build

echo "Lampa $(node -p "require('./build/github/lampa/assembly.json').app_version") built from $(git rev-parse --short HEAD)"
