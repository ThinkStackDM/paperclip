#!/bin/bash
# generate-image.sh — provider-agnostic image generation for the ThinkStack fleet.
#
# Usage:
#   generate-image.sh "PROMPT" OUTFILE.png [--steps N] [--size WxH] [--seed N]
#
# Provider selection (env IMAGE_PROVIDER):
#   local       (DEFAULT) — Apple-Silicon MLX FLUX.1-schnell, FREE, unlimited, on-device.
#                            One-time setup: bash scripts/imagegen/setup-local.sh
#   cloudflare  — Cloudflare Workers AI @cf/black-forest-labs/flux-1-schnell.
#                 Requires DEDICATED, opt-in vars (NOT the DNS CLOUDFLARE_API_TOKEN):
#                   CF_IMAGE_API_TOKEN  + CF_ACCOUNT_ID
#   gemini      — Google Gemini image API (PAID-only as of 2026-06; free tier limit:0).
#                 Requires GEMINI_API_KEY (or GOOGLE_API_KEY).
#
# Exit codes:
#   0  success            3  provider not configured / not set up
#   2  usage error        4  provider API/generation error
#                         5  response contained no image
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PROMPT="${1:-}"
OUTFILE="${2:-}"
if [ "$#" -ge 2 ]; then shift 2; else set --; fi
EXTRA_ARGS=("$@")   # passed through to local provider (--steps/--size/--seed)

PROVIDER="${IMAGE_PROVIDER:-local}"

if [ -z "$PROMPT" ] || [ -z "$OUTFILE" ]; then
  echo "usage: generate-image.sh \"PROMPT\" OUTFILE.png [--steps N] [--size WxH] [--seed N]" >&2
  echo "       IMAGE_PROVIDER=local|cloudflare|gemini (default: local)" >&2
  exit 2
fi

# ---------------------------------------------------------------------------
case "$PROVIDER" in

  local)
    if [ ! -x "$HERE/.venv/bin/mflux-generate" ]; then
      cat >&2 <<MSG
ERROR: local image model isn't installed yet.
Run scripts/imagegen/setup-local.sh once to enable free local image generation,
or set IMAGE_PROVIDER=cloudflare with CF_IMAGE_API_TOKEN (and CF_ACCOUNT_ID).
MSG
      exit 3
    fi
    exec "$HERE/local-image.sh" "$PROMPT" "$OUTFILE" "${EXTRA_ARGS[@]}"
    ;;

  cloudflare)
    # Deliberately require DEDICATED vars so the user opts in consciously.
    # Do NOT fall back to CLOUDFLARE_API_TOKEN (that is provisioned for DNS).
    CF_TOKEN="${CF_IMAGE_API_TOKEN:-}"
    CF_ACCT="${CF_ACCOUNT_ID:-}"
    CF_MODEL="${CF_IMAGE_MODEL:-@cf/black-forest-labs/flux-1-schnell}"
    if [ -z "$CF_TOKEN" ] || [ -z "$CF_ACCT" ]; then
      cat >&2 <<'MSG'
ERROR: IMAGE_PROVIDER=cloudflare needs CF_IMAGE_API_TOKEN and CF_ACCOUNT_ID.
These must be a DEDICATED Workers-AI token you set explicitly — this script will
NOT reuse CLOUDFLARE_API_TOKEN (that is provisioned for DNS, not image gen).
Create a Workers AI token at dash.cloudflare.com → My Profile → API Tokens.
MSG
      exit 3
    fi
    RESP=$(mktemp); trap 'rm -f "$RESP"' EXIT
    HTTP_CODE=$(curl -sS -o "$RESP" -w '%{http_code}' \
      "https://api.cloudflare.com/client/v4/accounts/${CF_ACCT}/ai/run/${CF_MODEL}" \
      -H "Authorization: Bearer ${CF_TOKEN}" \
      -H 'Content-Type: application/json' \
      -d "$(python3 -c 'import json,sys;print(json.dumps({"prompt":sys.argv[1]}))' "$PROMPT")")
    if [ "$HTTP_CODE" != "200" ]; then
      echo "ERROR: Cloudflare Workers AI returned HTTP $HTTP_CODE for $CF_MODEL" >&2
      head -c 500 "$RESP" >&2; echo >&2
      exit 4
    fi
    # flux-1-schnell returns {"result":{"image":"<base64 jpeg>"},"success":true}
    python3 - "$RESP" "$OUTFILE" <<'PY'
import base64, json, sys
resp, out = sys.argv[1], sys.argv[2]
d = json.load(open(resp))
img = (d.get("result") or {}).get("image")
if not img:
    print("ERROR: Cloudflare response contained no image", file=sys.stderr); sys.exit(5)
open(out, "wb").write(base64.b64decode(img))
print(f"wrote {out} (cloudflare {len(img)} b64 chars)")
PY
    ;;

  gemini)
    MODEL="${GEMINI_IMAGE_MODEL:-gemini-2.5-flash-image}"
    API_KEY="${GEMINI_API_KEY:-${GOOGLE_API_KEY:-}}"
    if [ -z "$API_KEY" ]; then
      cat >&2 <<'MSG'
ERROR: IMAGE_PROVIDER=gemini needs GEMINI_API_KEY.
NOTE: as of 2026-06 Gemini image gen is PAID-only (free tier limit is 0).
Prefer IMAGE_PROVIDER=local (free, on-device). The local gemini CLI uses OAuth
and does not support image generation.
MSG
      exit 3
    fi
    RESP=$(mktemp); trap 'rm -f "$RESP"' EXIT
    HTTP_CODE=$(curl -sS -o "$RESP" -w '%{http_code}' \
      "https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent" \
      -H "x-goog-api-key: ${API_KEY}" \
      -H 'Content-Type: application/json' \
      -X POST \
      -d "$(python3 - "$PROMPT" <<'PY'
import json, sys
print(json.dumps({
    "contents": [{"parts": [{"text": sys.argv[1]}]}],
    "generationConfig": {"responseModalities": ["IMAGE", "TEXT"]},
}))
PY
)")
    if [ "$HTTP_CODE" != "200" ]; then
      echo "ERROR: Gemini API returned HTTP $HTTP_CODE for model $MODEL" >&2
      # Surface the API's own error detail (don't swallow stderr).
      if ! ERR_MSG=$(python3 -c "import json,sys;d=json.load(open(sys.argv[1]));print(d.get('error',{}).get('message','(no error message)'))" "$RESP" 2>/dev/null); then
        ERR_MSG=$(head -c 400 "$RESP")
      fi
      echo "$ERR_MSG" >&2
      exit 4
    fi
    python3 - "$RESP" "$OUTFILE" <<'PY'
import base64, json, sys
resp_path, outfile = sys.argv[1], sys.argv[2]
with open(resp_path) as f:
    data = json.load(f)
for cand in data.get("candidates", []):
    for part in cand.get("content", {}).get("parts", []):
        blob = part.get("inlineData") or part.get("inline_data")
        if blob and blob.get("data"):
            with open(outfile, "wb") as out:
                out.write(base64.b64decode(blob["data"]))
            print(f"wrote {outfile} ({blob.get('mimeType') or blob.get('mime_type')})")
            sys.exit(0)
print("ERROR: response contained no image data (model may have refused; try rephrasing)", file=sys.stderr)
sys.exit(5)
PY
    ;;

  *)
    echo "ERROR: unknown IMAGE_PROVIDER='$PROVIDER' (use: local|cloudflare|gemini)" >&2
    exit 2
    ;;
esac
