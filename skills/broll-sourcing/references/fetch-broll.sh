#!/usr/bin/env bash
# fetch-broll.sh — search + download free, licensed b-roll into a workspace assets
# dir with a manifest.json. Sources: Pexels (PEXELS_API_KEY) and Openverse (no key).
# With no keys it still works: Openverse images run keyless; for Pexels it prints
# key-setup instructions instead of failing.
#
# Usage:
#   fetch-broll.sh "QUERY" [--type video|photo] [--count N] [--out DIR]
#
#   --type   video (Pexels only) or photo (Pexels + Openverse). Default: video
#   --count  assets to fetch per source. Default: 2
#   --out    output dir. Default: assets/broll
#
# Every download appends an entry to <out>/manifest.json (source URL, licence,
# author, attribution). See ../SKILL.md for the hard rules.
set -euo pipefail

QUERY="${1:-}"; shift || true
TYPE="video"; COUNT=2; OUT="assets/broll"
while [ $# -gt 0 ]; do
  case "$1" in
    --type)  TYPE="$2"; shift 2;;
    --count) COUNT="$2"; shift 2;;
    --out)   OUT="$2"; shift 2;;
    *) echo "unknown arg: $1" >&2; exit 2;;
  esac
done
[ -n "$QUERY" ] || { sed -n '2,15p' "$0"; exit 2; }
command -v jq >/dev/null || { echo "FATAL: jq required" >&2; exit 1; }
mkdir -p "$OUT"
MANIFEST="$OUT/manifest.json"
[ -s "$MANIFEST" ] || echo "[]" > "$MANIFEST"
ENC_QUERY="$(jq -rn --arg q "$QUERY" '$q|@uri')"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

add_manifest() { # file source_url source licence author attr_req attr_text
  jq --arg f "$1" --arg u "$2" --arg s "$3" --arg l "$4" --arg a "$5" \
     --argjson r "$6" --arg t "$7" --arg q "$QUERY" --arg n "$NOW" \
     '. += [{file:$f, source_url:$u, source:$s, licence:$l, author:$a,
             attribution_required:$r, attribution_text:$t, query:$q, fetched_at:$n}]' \
     "$MANIFEST" > "$MANIFEST.tmp" && mv "$MANIFEST.tmp" "$MANIFEST"
}

# ---------- Pexels ----------
if [ -z "${PEXELS_API_KEY:-}" ]; then
  cat >&2 <<'EOF'
[pexels] PEXELS_API_KEY not set — skipping Pexels.
         Get a free key (≈200 req/hr, 20k/month): https://www.pexels.com/api/
         Then: export PEXELS_API_KEY=...   (or add it to company secrets)
EOF
else
  if [ "$TYPE" = "video" ]; then
    RESP="$(curl -sf -H "Authorization: $PEXELS_API_KEY" \
      "https://api.pexels.com/videos/search?query=$ENC_QUERY&per_page=$COUNT")" || RESP=""
    echo "$RESP" | jq -c '.videos[]? ' | while read -r v; do
      ID="$(jq -r '.id' <<<"$v")"; PAGE="$(jq -r '.url' <<<"$v")"
      USER="$(jq -r '.user.name' <<<"$v")"
      LINK="$(jq -r '[.video_files[] | select(.height!=null and .height>=1080)] + .video_files | .[0].link' <<<"$v")"
      F="pexels-$ID.mp4"
      echo "[pexels] $F  <-  $PAGE"
      curl -sfL "$LINK" -o "$OUT/$F" && \
        add_manifest "$F" "$PAGE" "pexels" "Pexels License" "$USER" false ""
    done
  else
    RESP="$(curl -sf -H "Authorization: $PEXELS_API_KEY" \
      "https://api.pexels.com/v1/search?query=$ENC_QUERY&per_page=$COUNT")" || RESP=""
    echo "$RESP" | jq -c '.photos[]?' | while read -r p; do
      ID="$(jq -r '.id' <<<"$p")"; PAGE="$(jq -r '.url' <<<"$p")"
      USER="$(jq -r '.photographer' <<<"$p")"; LINK="$(jq -r '.src.large2x' <<<"$p")"
      F="pexels-$ID.jpg"
      echo "[pexels] $F  <-  $PAGE"
      curl -sfL "$LINK" -o "$OUT/$F" && \
        add_manifest "$F" "$PAGE" "pexels" "Pexels License" "$USER" false ""
    done
  fi
fi

# ---------- Openverse (images only, keyless, CC commercial+modification) ----------
if [ "$TYPE" = "photo" ]; then
  RESP="$(curl -sf "https://api.openverse.org/v1/images/?q=$ENC_QUERY&license_type=commercial,modification&page_size=$COUNT")" || {
    echo "[openverse] request failed (rate limit? offline?) — skipping" >&2; RESP=""; }
  echo "$RESP" | jq -c '.results[]?' 2>/dev/null | while read -r r; do
    ID="$(jq -r '.id' <<<"$r")"; PAGE="$(jq -r '.foreign_landing_url' <<<"$r")"
    LIC="CC $(jq -r '.license' <<<"$r") $(jq -r '.license_version // ""' <<<"$r")"
    AUTHOR="$(jq -r '.creator // "unknown"' <<<"$r")"
    ATTR="$(jq -r '.attribution // ""' <<<"$r")"
    URL="$(jq -r '.url' <<<"$r")"
    EXT="${URL##*.}"; case "$EXT" in jpg|jpeg|png|gif|webp) ;; *) EXT="jpg";; esac
    F="openverse-$ID.$EXT"
    echo "[openverse] $F  <-  $PAGE  ($LIC)"
    curl -sfL "$URL" -o "$OUT/$F" && \
      add_manifest "$F" "$PAGE" "openverse" "$LIC" "$AUTHOR" true "$ATTR"
  done
else
  echo "[openverse] indexes images/audio only — no video source here. For more video: Pixabay API, NASA, coverr.co (see api-reference.md)." >&2
fi

echo
echo "manifest: $MANIFEST"
jq -r '.[-5:][] | "  \(.file)  [\(.licence)]\(if .attribution_required then "  ATTRIBUTION REQUIRED" else "" end)"' "$MANIFEST"
