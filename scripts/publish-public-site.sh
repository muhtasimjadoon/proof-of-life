#!/usr/bin/env bash
# Publish the public read-only copy of your page to GitHub Pages:
#   https://<owner>.github.io/proof-of-life/
# Rebuilds from the running local server first (scripts/build-public-site.mjs),
# then force-pushes the site to the gh-pages branch and turns Pages on once.
# Run again any time to update the public copy.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE="$ROOT/../proof-of-life-site"
REPO="${POL_REPO:-muhtasimjadoon/proof-of-life}"

node "$ROOT/scripts/build-public-site.mjs" --out "$SITE"

cd "$SITE"
rm -rf .git
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C "$ROOT" config user.name || echo pol)" -c user.email="$(git -C "$ROOT" config user.email || echo pol@localhost)" \
  commit -q -m "Public copy of the Proof of Life page ($(date -u +%Y-%m-%d))"
git push -q -f "https://github.com/$REPO.git" gh-pages

# turn Pages on (first run) or leave it as it is
if ! gh api "repos/$REPO/pages" >/dev/null 2>&1; then
  gh api -X POST "repos/$REPO/pages" -f "source[branch]=gh-pages" -f "source[path]=/" >/dev/null
fi
echo "Published. Live in about a minute at: $(gh api "repos/$REPO/pages" --jq .html_url)"
